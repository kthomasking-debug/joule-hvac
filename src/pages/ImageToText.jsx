import React, { useState, useRef } from "react";
import { Upload, Image as ImageIcon, Loader2, Copy, Check, AlertCircle, Download, Database, FileText } from "lucide-react";
import { addToUserKnowledge } from "../utils/rag/ragQuery";

/**
 * Image to Text (OCR) Converter
 * Extract text from images and screenshots using OCR
 * Perfect for extracting text from PDF images or screenshots
 */
export default function ImageToText() {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAddingToRAG, setIsAddingToRAG] = useState(false);
  const [ragStatus, setRagStatus] = useState(null); // { success: boolean, message: string }
  const [confidence, setConfidence] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, GIF, etc.)");
      return;
    }

    // Check file size (limit to 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size too large. Please select an image smaller than 10MB");
      return;
    }

    setFile(selectedFile);
    setError("");
    setExtractedText("");
    setConfidence(null);
  };

  const extractTextFromImage = async () => {
    if (!file) {
      setError("Please select an image first");
      return;
    }

    setIsExtracting(true);
    setError("");
    setExtractedText("");
    setConfidence(null);

    try {
      // Dynamically import Tesseract.js
      const Tesseract = await import("tesseract.js");

      // Show progress
      const result = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            // Progress updates available here if needed
          }
        },
      });

      const text = result.data.text.trim();
      const conf = result.data.confidence;

      if (!text) {
        setError("No text found in image. The image may not contain readable text, or the text may be too small/blurry.");
        setIsExtracting(false);
        return;
      }

      setExtractedText(text);
      setConfidence(conf);
    } catch (err) {
      console.error("OCR extraction error:", err);
      let errorMessage = "Failed to extract text from image.";
      
      if (err.message?.includes("worker")) {
        errorMessage = "Failed to load OCR worker. Please check your internet connection.";
      } else if (err.message?.includes("language")) {
        errorMessage = "OCR language data not available. Please check your connection.";
      }
      
      setError(errorMessage);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCopy = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    if (!extractedText) return;
    
    const blob = new Blob([extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file ? file.name.replace(/\.[^/.]+$/, ".txt") : "extracted-text.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddToRAG = async () => {
    if (!extractedText || !extractedText.trim()) {
      setRagStatus({
        success: false,
        message: "No text to add. Please extract text from image first.",
      });
      return;
    }

    setIsAddingToRAG(true);
    setRagStatus(null);
    setError("");

    try {
      const title = file
        ? `${file.name.replace(/\.[^/.]+$/, "")} (OCR Text)`
        : `OCR Text ${new Date().toLocaleDateString()}`;

      // Add metadata about OCR confidence
      const metadata = confidence !== null 
        ? `\n\n[OCR Confidence: ${confidence.toFixed(1)}%]`
        : "";
      const content = extractedText + metadata;

      const result = await addToUserKnowledge(title, content, "image-ocr");

      if (result.success) {
        setRagStatus({
          success: true,
          message: `Successfully added "${title}" to Ask Joule knowledge base. You can now ask questions about this content!`,
        });
        // Clear status after 5 seconds
        setTimeout(() => setRagStatus(null), 5000);
      } else {
        throw new Error(result.error || "Failed to add to knowledge base");
      }
    } catch (err) {
      console.error("RAG addition error:", err);
      setRagStatus({
        success: false,
        message: err.message || "Failed to add text to knowledge base. Please try again.",
      });
    } finally {
      setIsAddingToRAG(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      setFile(droppedFile);
      setError("");
      setExtractedText("");
      setConfidence(null);
    } else {
      setError("Please drop an image file");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Image to Text (OCR)
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Extract text from images and screenshots using OCR. Perfect for extracting text from PDF images, screenshots, or scanned documents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Upload Image
          </h2>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Drag and drop an image here, or click to select
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Supports PNG, JPG, GIF, WebP (max 10MB)
            </p>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setExtractedText("");
                    setError("");
                    setConfidence(null);
                  }}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <button
            onClick={extractTextFromImage}
            disabled={!file || isExtracting}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Extracting Text...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Extract Text
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Extracted Text
          </h2>

          {extractedText ? (
            <div className="space-y-4">
              {confidence !== null && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>OCR Confidence: {confidence.toFixed(1)}%</span>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-96 overflow-auto">
                <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-sans">
                  {extractedText}
                </pre>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handleAddToRAG}
                  disabled={isAddingToRAG}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAddingToRAG ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Add to RAG
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {extractedText.length} characters extracted
              </p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Extract text from an image to see results here</p>
            </div>
          )}

          {/* RAG Status Message */}
          {ragStatus && (
            <div
              className={`mt-6 p-4 rounded-md flex items-start ${
                ragStatus.success
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              {ragStatus.success ? (
                <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              )}
              <p
                className={`text-sm ${
                  ragStatus.success
                    ? "text-green-700 dark:text-green-300"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                {ragStatus.message}
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
              <strong>Privacy:</strong> All processing happens in your browser. No files are uploaded to any server.
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
              <strong>Maximum file size:</strong> 10MB. Clear, high-contrast images work best.
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>RAG Integration:</strong> The "Add to RAG" button adds the extracted text to your local knowledge base. You can then ask Ask Joule questions about this content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

