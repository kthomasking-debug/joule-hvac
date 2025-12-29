import React, { useState, useRef, useEffect } from "react";
import { Upload, FileAudio, Loader2, Copy, Check, AlertCircle, Info, Trash2, X, List, Play, Download } from "lucide-react";
import { saveAudioFile, getAllAudioFiles, deleteAudioFile, getAudioFile } from "../lib/audioDatabase";

/**
 * Audio Transcription Page
 * Upload WAV files and convert them to text using various providers
 */
export default function AudioTranscription() {
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [provider, setProvider] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("transcriptionProvider") || "assemblyai";
    }
    return "assemblyai";
  });
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("transcriptionApiKey") || "";
    }
    return "";
  });
  const [savedFiles, setSavedFiles] = useState([]);
  const [showSavedFiles, setShowSavedFiles] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const fileInputRef = useRef(null);

  // Load saved files on mount
  useEffect(() => {
    loadSavedFiles();
  }, []);

  const loadSavedFiles = async () => {
    setLoadingFiles(true);
    try {
      const files = await getAllAudioFiles();
      setSavedFiles(files);
    } catch (error) {
      console.error("Failed to load saved files:", error);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleLoadSavedFile = async (fileId) => {
    try {
      const savedFile = await getAudioFile(fileId);
      if (savedFile && savedFile.blob) {
        // Create a File object from the blob
        const file = new File([savedFile.blob], savedFile.filename, { type: savedFile.type });
        setFile(file);
        setTranscript("");
        setError("");
        setShowSavedFiles(false);
      }
    } catch (error) {
      console.error("Failed to load saved file:", error);
      setError("Failed to load saved file");
    }
  };

  const handleDeleteSavedFile = async (fileId) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    
    try {
      await deleteAudioFile(fileId);
      await loadSavedFiles(); // Reload the list
    } catch (error) {
      console.error("Failed to delete file:", error);
      setError("Failed to delete file");
    }
  };

  const handleDownloadSavedFile = (fileUrl, filename) => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Accept WAV and MP3 files
    const validExtensions = [".wav", ".mp3", ".m4a", ".webm", ".ogg"];
    const fileExt = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf("."));
    
    if (!validExtensions.includes(fileExt)) {
      setError(`Please select an audio file (${validExtensions.join(", ")})`);
      return;
    }

    setFile(selectedFile);
    setError("");
    setTranscript("");

    // Save file to IndexedDB
    try {
      await saveAudioFile(selectedFile);
      await loadSavedFiles(); // Refresh the list
    } catch (error) {
      console.warn("Failed to save file to IndexedDB:", error);
      // Don't show error to user - saving is optional
    }
  };

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    if (typeof window !== "undefined") {
      localStorage.setItem("transcriptionProvider", newProvider);
    }
  };

  const handleApiKeyChange = (e) => {
    const key = e.target.value;
    setApiKey(key);
    if (key) {
      localStorage.setItem("transcriptionApiKey", key);
    } else {
      localStorage.removeItem("transcriptionApiKey");
    }
  };

  const transcribeWithWebSpeech = async () => {
    // Note: Web Speech API doesn't directly support file transcription.
    // This is a workaround that plays the audio and attempts to capture it.
    // It's not reliable and may not work well. Consider using AssemblyAI or Deepgram free tiers instead.
    throw new Error("Web Speech API doesn't support file transcription. Please use AssemblyAI or Deepgram (both have free tiers) for file transcription.");
  };

  const transcribeWithAssemblyAI = async () => {
    // Step 1: Upload file and get upload URL
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: apiKey,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file");
    }

    const { upload_url } = await uploadResponse.json();

    // Step 2: Start transcription
    const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: upload_url,
      }),
    });

    if (!transcriptResponse.ok) {
      const error = await transcriptResponse.json();
      throw new Error(error.error || "Failed to start transcription");
    }

    const { id } = await transcriptResponse.json();

    // Step 3: Poll for results
    while (true) {
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: {
          authorization: apiKey,
        },
      });

      const status = await statusResponse.json();

      if (status.status === "completed") {
        return status.text;
      } else if (status.status === "error") {
        throw new Error(status.error || "Transcription failed");
      }

      // Wait 1 second before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };

  const transcribeWithDeepgram = async () => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://api.deepgram.com/v1/listen?punctuate=true&diarize=false", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.err_msg || `API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  };

  const transcribeWithOpenAI = async () => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text || "";
  };

  const transcribeAudio = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    if (provider !== "web-speech" && !apiKey) {
      setError(`Please enter your ${provider === "openai" ? "OpenAI" : provider === "assemblyai" ? "AssemblyAI" : "Deepgram"} API key`);
      return;
    }

    setIsTranscribing(true);
    setError("");
    setTranscript("");

    try {
      let result = "";
      
      switch (provider) {
        case "web-speech":
          result = await transcribeWithWebSpeech();
          break;
        case "assemblyai":
          result = await transcribeWithAssemblyAI();
          break;
        case "deepgram":
          result = await transcribeWithDeepgram();
          break;
        case "openai":
          result = await transcribeWithOpenAI();
          break;
        default:
          throw new Error("Unknown provider");
      }

      setTranscript(result || "No transcript generated");
    } catch (err) {
      console.error("Transcription error:", err);
      setError(err.message || "Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopy = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleClearAll = () => {
    setFile(null);
    setTranscript("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const validExtensions = [".wav", ".mp3", ".m4a", ".webm", ".ogg"];
      const fileExt = droppedFile.name.toLowerCase().substring(droppedFile.name.lastIndexOf("."));
      if (validExtensions.includes(fileExt)) {
        setFile(droppedFile);
        setError("");
        setTranscript("");
      } else {
        setError(`Please drop an audio file (${validExtensions.join(", ")})`);
      }
    } else {
      setError("Please drop an audio file");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
            Audio Transcription
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload audio files and convert them to text using various providers
          </p>

          {/* Saved Files Section */}
          <div className="mb-6">
            <button
              onClick={() => setShowSavedFiles(!showSavedFiles)}
              className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <List className="h-4 w-4 mr-2" />
              {showSavedFiles ? "Hide" : "Show"} Saved Files ({savedFiles.length})
            </button>

            {showSavedFiles && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                {loadingFiles ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading files...</span>
                  </div>
                ) : savedFiles.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No saved files. Upload a file to save it automatically.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedFiles.map((savedFile) => (
                      <div
                        key={savedFile.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          <FileAudio className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {savedFile.filename}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(savedFile.size / 1024 / 1024).toFixed(2)} MB • {new Date(savedFile.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleLoadSavedFile(savedFile.id)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                            title="Load file"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadSavedFile(savedFile.url, savedFile.filename)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSavedFile(savedFile.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Provider Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transcription Provider
            </label>
            <select
              value={provider}
              onChange={handleProviderChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="assemblyai">AssemblyAI (Free: 5 hours/month) ⭐ Recommended</option>
              <option value="deepgram">Deepgram (Free: 12,000 min/month)</option>
              <option value="openai">OpenAI Whisper (Paid: $0.006/min)</option>
            </select>
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-start">
                <Info className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  {provider === "assemblyai" && (
                    <>Free tier: 5 hours/month. Get API key at{" "}
                    <a href="https://www.assemblyai.com/app/account" target="_blank" rel="noopener noreferrer" className="underline">assemblyai.com/app/account</a> (sign up is free)</>
                  )}
                  {provider === "deepgram" && (
                    <>Free tier: 12,000 minutes/month (200 hours!). Get API key at{" "}
                    <a href="https://console.deepgram.com/signup" target="_blank" rel="noopener noreferrer" className="underline">console.deepgram.com</a> (sign up is free)</>
                  )}
                  {provider === "openai" && (
                    <>Paid service: $0.006 per minute (~$0.36/hour). Get API key at{" "}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com</a></>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* API Key Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {provider === "openai" ? "OpenAI" : provider === "assemblyai" ? "AssemblyAI" : "Deepgram"} API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={provider === "openai" ? "sk-..." : provider === "assemblyai" ? "Enter AssemblyAI API key" : "Enter Deepgram API key"}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Your API key is stored locally in your browser and never sent to our servers.
            </p>
          </div>

          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center mb-6 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.webm,.ogg,audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <FileAudio className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            {file ? (
              <div className="relative">
                <button
                  onClick={handleClearAll}
                  className="absolute top-0 right-0 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Delete file"
                >
                  <X className="h-5 w-5" />
                </button>
                <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                  {file.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={handleClearAll}
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete File
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Drag and drop a WAV file here, or
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select File
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Transcribe Button */}
          <button
            onClick={transcribeAudio}
            disabled={!file || !apiKey || isTranscribing}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Transcribing...
              </>
            ) : (
              "Transcribe Audio"
            )}
          </button>

          {/* Transcript Display */}
          {transcript && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Transcript
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="inline-flex items-center px-3 py-1 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title="Delete file and transcript"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </button>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {transcript}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

