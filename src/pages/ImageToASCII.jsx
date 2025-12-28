import React, { useState, useRef, useEffect } from "react";
import { Upload, Image as ImageIcon, Loader2, Copy, Check, AlertCircle, Download, Database, FileText } from "lucide-react";
import { addToUserKnowledge } from "../utils/rag/ragQuery";

/**
 * Image to ASCII Converter
 * Upload images and convert them to ASCII art
 * Perfect for extracting diagrams from manuals and adding to RAG database
 */
export default function ImageToASCII() {
  const [file, setFile] = useState(null);
  const [asciiArt, setAsciiArt] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAddingToRAG, setIsAddingToRAG] = useState(false);
  const [ragStatus, setRagStatus] = useState(null); // { success: boolean, message: string }
  const [width, setWidth] = useState(80); // ASCII art width in characters
  const [wiringMode, setWiringMode] = useState(false); // Wiring diagram mode - only detect wires and terminals
  const [extractText, setExtractText] = useState(false); // OCR mode - extract text from image
  const [extractedText, setExtractedText] = useState(""); // OCR extracted text
  const [isExtractingText, setIsExtractingText] = useState(false); // OCR in progress
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const pasteAreaRef = useRef(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

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
    setAsciiArt("");
    setExtractedText("");
    setOcrConfidence(null);
    // Create preview URL
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(URL.createObjectURL(selectedFile));
  };

  const convertImageToASCII = async () => {
    if (!file) {
      setError("Please select an image first");
      return;
    }

    setIsConverting(true);
    setError("");
    setAsciiArt("");

    try {
      // Create image element
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = async () => {
        try {
          // Create canvas to process image
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // Calculate dimensions maintaining aspect ratio
          // ASCII characters are roughly 2:1 (height:width), so adjust accordingly
          const aspectRatio = img.height / img.width;
          const targetWidth = width;
          const targetHeight = Math.round(targetWidth * aspectRatio * 0.55); // Adjusted for better proportions

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          // Draw image to canvas with better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Get image data
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const data = imageData.data;

          let ascii = "";

          if (wiringMode) {
            // Wiring Diagram Mode: Use edge detection to highlight wires and terminals
            // Convert to grayscale first
            const gray = new Uint8Array(targetWidth * targetHeight);
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            }

            // Apply Sobel edge detection
            const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
            const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
            const edges = new Uint8Array(targetWidth * targetHeight);

            for (let y = 1; y < targetHeight - 1; y++) {
              for (let x = 1; x < targetWidth - 1; x++) {
                let gx = 0, gy = 0;
                for (let ky = -1; ky <= 1; ky++) {
                  for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * targetWidth + (x + kx);
                    const kernelIdx = (ky + 1) * 3 + (kx + 1);
                    gx += gray[idx] * sobelX[kernelIdx];
                    gy += gray[idx] * sobelY[kernelIdx];
                  }
                }
                const magnitude = Math.min(255, Math.sqrt(gx * gx + gy * gy));
                edges[y * targetWidth + x] = magnitude;
              }
            }

            // Threshold and convert to ASCII
            const threshold = 30;
            for (let y = 0; y < targetHeight; y++) {
              for (let x = 0; x < targetWidth; x++) {
                const idx = y * targetWidth + x;
                const edgeValue = edges[idx];
                
                if (edgeValue > threshold) {
                  // Check if it's a terminal (dense edge area)
                  let terminalDensity = 0;
                  for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                      const ny = y + dy;
                      const nx = x + dx;
                      if (ny >= 0 && ny < targetHeight && nx >= 0 && nx < targetWidth) {
                        if (edges[ny * targetWidth + nx] > threshold) terminalDensity++;
                      }
                    }
                  }
                  
                  if (terminalDensity > 15) {
                    ascii += "█"; // Terminal
                  } else {
                    // Determine wire direction
                    const hEdge = (x > 0 && edges[idx - 1] > threshold) || (x < targetWidth - 1 && edges[idx + 1] > threshold);
                    const vEdge = (y > 0 && edges[idx - targetWidth] > threshold) || (y < targetHeight - 1 && edges[idx + targetWidth] > threshold);
                    
                    if (hEdge && vEdge) {
                      ascii += "+"; // Intersection
                    } else if (hEdge) {
                      ascii += "─"; // Horizontal wire
                    } else if (vEdge) {
                      ascii += "│"; // Vertical wire
                    } else {
                      ascii += "·"; // Edge point
                    }
                  }
                } else {
                  ascii += " "; // Background
                }
              }
              ascii += "\n";
            }
          } else {
            // Standard ASCII Art Mode
            // Better ASCII character set - more gradient steps for better detail
            // From darkest to lightest
            const asciiChars = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

            // Convert to grayscale and normalize brightness values
            const brightnessValues = [];
            for (let y = 0; y < targetHeight; y++) {
              for (let x = 0; x < targetWidth; x++) {
                const index = (y * targetWidth + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const a = data[index + 3];

                // Calculate brightness using luminance formula (more accurate)
                const brightness = (r * 0.299 + g * 0.587 + b * 0.114) * (a / 255);
                brightnessValues.push(brightness);
              }
            }

            // Normalize brightness values to improve contrast
            const minBrightness = Math.min(...brightnessValues);
            const maxBrightness = Math.max(...brightnessValues);
            const brightnessRange = maxBrightness - minBrightness || 1; // Avoid division by zero

            // Convert to ASCII with normalized brightness
            for (let y = 0; y < targetHeight; y++) {
              for (let x = 0; x < targetWidth; x++) {
                const index = y * targetWidth + x;
                const brightness = brightnessValues[index];
                
                // Normalize brightness to 0-1 range
                const normalizedBrightness = (brightness - minBrightness) / brightnessRange;
                
                // Map to ASCII character (invert so darker = darker chars)
                const charIndex = Math.floor((1 - normalizedBrightness) * (asciiChars.length - 1));
                ascii += asciiChars[charIndex];
              }
              ascii += "\n";
            }
          }

          setAsciiArt(ascii);
          
          // If extractText is enabled, also run OCR on the original image
          if (extractText) {
            setIsExtractingText(true);
            try {
              const Tesseract = await import("tesseract.js");
              // Use the file directly for better OCR quality
              const result = await Tesseract.recognize(file, "eng", {
                logger: (m) => {
                  if (m.status === "recognizing text") {
                    // Progress updates available here if needed
                  }
                },
              });
              
              const text = result.data.text.trim();
              const conf = result.data.confidence;
              
              setExtractedText(text || "No text found in image.");
              setOcrConfidence(conf);
            } catch (ocrErr) {
              console.error("OCR error:", ocrErr);
              setExtractedText("Failed to extract text from image.");
              setOcrConfidence(null);
            } finally {
              setIsExtractingText(false);
            }
          }
          
          URL.revokeObjectURL(objectUrl);
        } catch (err) {
          console.error("Conversion error:", err);
          setError("Failed to convert image. Please try again.");
        } finally {
          setIsConverting(false);
        }
      };

      img.onerror = () => {
        setError("Failed to load image. Please try a different file.");
        setIsConverting(false);
        URL.revokeObjectURL(objectUrl);
      };

      img.src = objectUrl;
    } catch (err) {
      console.error("Image conversion error:", err);
      setError(err.message || "Failed to convert image. Please try again.");
      setIsConverting(false);
    }
  };

  const handleCopy = async () => {
    if (!asciiArt) return;
    try {
      await navigator.clipboard.writeText(asciiArt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    if (!asciiArt) return;

    const blob = new Blob([asciiArt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file ? file.name.replace(/\.[^/.]+$/, ".txt") : "ascii-art.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddToRAG = async () => {
    if (!asciiArt || !asciiArt.trim()) {
      setRagStatus({
        success: false,
        message: "No ASCII art to add. Please convert an image first.",
      });
      return;
    }

    setIsAddingToRAG(true);
    setRagStatus(null);
    setError("");

    try {
      const title = file
        ? `${file.name.replace(/\.[^/.]+$/, "")} (ASCII Art)`
        : `ASCII Art ${new Date().toLocaleDateString()}`;

      // Add description to make it more useful in RAG
      const description = `ASCII art representation of an image${file ? ` from ${file.name}` : ""}. This can be used to understand diagrams, schematics, or visual content from manuals.`;
      const content = `${description}\n\n${asciiArt}`;

      const result = await addToUserKnowledge(title, content, "image-to-ascii");

      if (result.success) {
        setRagStatus({
          success: true,
          message: `Successfully added "${title}" to Ask Joule knowledge base. You can now ask questions about this image content!`,
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
        message: err.message || "Failed to add ASCII art to knowledge base. Please try again.",
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
      setAsciiArt("");
      setExtractedText("");
      setOcrConfidence(null);
      // Create preview URL
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImagePreviewUrl(URL.createObjectURL(droppedFile));
    } else {
      setError("Please drop an image file");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Handle paste events
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          // Create a File object from the blob
          const pastedFile = new File([blob], `pasted-image-${Date.now()}.png`, {
            type: item.type,
          });
          
          // Validate file size
          if (pastedFile.size > 10 * 1024 * 1024) {
            setError("Pasted image is too large. Maximum size is 10MB.");
            return;
          }

          setFile(pastedFile);
          setError("");
          setAsciiArt("");
          setExtractedText("");
          setOcrConfidence(null);
          // Create preview URL
          if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
          }
          setImagePreviewUrl(URL.createObjectURL(pastedFile));
        }
        break;
      }
    }
  };

  // Cleanup image preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Add paste event listener on mount
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            // Create a File object from the blob
            const pastedFile = new File([blob], `pasted-image-${Date.now()}.png`, {
              type: item.type,
            });
            
            // Validate file size
            if (pastedFile.size > 10 * 1024 * 1024) {
              setError("Pasted image is too large. Maximum size is 10MB.");
              return;
            }

            setFile(pastedFile);
            setError("");
            setAsciiArt("");
            setExtractedText("");
            setOcrConfidence(null);
            // Create preview URL
            if (imagePreviewUrl) {
              URL.revokeObjectURL(imagePreviewUrl);
            }
            setImagePreviewUrl(URL.createObjectURL(pastedFile));
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Image to ASCII Converter
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Convert images to ASCII art. Perfect for extracting diagrams from manuals and adding them to the RAG database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Upload Image
          </h2>

          {/* Drag & Drop / File Select Area */}
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

          {/* Separate Paste Area */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Or Paste from Clipboard
            </h3>
            <div
              ref={pasteAreaRef}
              onPaste={handlePaste}
              className="border-2 border-dashed border-purple-400 dark:border-purple-500 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors focus-within:ring-2 focus-within:ring-purple-500 bg-purple-50 dark:bg-purple-900/20"
              tabIndex={0}
              onFocus={(e) => {
                e.currentTarget.classList.add("ring-2", "ring-purple-500");
              }}
              onBlur={(e) => {
                e.currentTarget.classList.remove("ring-2", "ring-purple-500");
              }}
            >
              <p className="text-purple-700 dark:text-purple-300 mb-2 font-medium">
                Click here to focus, then paste (Ctrl+V / Cmd+V)
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Paste images from your clipboard
              </p>
            </div>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
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
                    if (imagePreviewUrl) {
                      URL.revokeObjectURL(imagePreviewUrl);
                      setImagePreviewUrl(null);
                    }
                    setFile(null);
                    setAsciiArt("");
                    setError("");
                    setExtractedText("");
                    setOcrConfidence(null);
                  }}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              {/* Image Preview */}
              {imagePreviewUrl && (
                <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="w-full h-auto max-h-64 object-contain bg-gray-100 dark:bg-gray-800"
                  />
                </div>
              )}
            </div>
          )}

          {/* Mode Toggles */}
          <div className="mt-4 space-y-3">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractText}
                  onChange={(e) => setExtractText(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Extract Text (OCR)
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                {extractText 
                  ? "Will extract text from the image using OCR in addition to ASCII conversion."
                  : "Enable to extract text from images (screenshots, scanned documents, etc.)"}
              </p>
            </div>
            
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wiringMode}
                  onChange={(e) => setWiringMode(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Wiring Diagram Mode (detect wires and terminals only)
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                {wiringMode 
                  ? "Only wires and terminals will be detected. Background and other elements will be ignored."
                  : "Full image conversion with all details."}
              </p>
            </div>
          </div>

          {/* Width Control */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ASCII Width: {width} characters
            </label>
            <input
              type="range"
              min="40"
              max="120"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lower values = smaller output, Higher values = more detail
            </p>
          </div>

          <button
            onClick={convertImageToASCII}
            disabled={!file || isConverting}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConverting || isExtractingText ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isExtractingText ? "Extracting text..." : "Converting..."}
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5" />
                Convert to ASCII{extractText ? " + Extract Text" : ""}
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
            Output
          </h2>

          {/* OCR Extracted Text */}
          {extractedText && (
            <div className="mb-6 space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Extracted Text (OCR)
              </h3>
              {ocrConfidence !== null && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  OCR Confidence: {ocrConfidence.toFixed(1)}%
                </p>
              )}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-48 overflow-auto">
                <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-sans">
                  {extractedText}
                </pre>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(extractedText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      console.error("Failed to copy:", err);
                    }
                  }}
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
                      Copy Text
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([extractedText], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = file ? file.name.replace(/\.[^/.]+$/, "-text.txt") : "extracted-text.txt";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Text
                </button>
                <button
                  onClick={async () => {
                    if (!extractedText || !extractedText.trim()) return;
                    setIsAddingToRAG(true);
                    setRagStatus(null);
                    try {
                      const title = file
                        ? `OCR Text: ${file.name.replace(/\.[^/.]+$/, "")}`
                        : `OCR Document ${new Date().toLocaleDateString()}`;
                      const result = await addToUserKnowledge(title, extractedText, "image-ocr");
                      if (result.success) {
                        setRagStatus({
                          success: true,
                          message: `Successfully added "${title}" to Ask Joule knowledge base.`,
                        });
                        setTimeout(() => setRagStatus(null), 5000);
                      } else {
                        throw new Error(result.error || "Failed to add to knowledge base");
                      }
                    } catch (err) {
                      setRagStatus({
                        success: false,
                        message: err.message || "Failed to add text to knowledge base.",
                      });
                    } finally {
                      setIsAddingToRAG(false);
                    }
                  }}
                  disabled={isAddingToRAG || !extractedText}
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
                      Add Text to RAG
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ASCII Art Output */}
          {asciiArt ? (
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
                <pre className="text-xs text-green-400 font-mono whitespace-pre">
                  {asciiArt}
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
                {asciiArt.length} characters
              </p>
            </div>
          ) : !extractedText ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Convert an image to see ASCII art here</p>
            </div>
          ) : null}

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
              <strong>Maximum file size:</strong> 10MB. Complex images may take longer to convert.
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>RAG Integration:</strong> The "Add to RAG" button adds the ASCII art to your local knowledge base. You can then ask Ask Joule questions about the image content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

