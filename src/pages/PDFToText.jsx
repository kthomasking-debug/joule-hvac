import React, { useState, useRef } from "react";
import { Upload, FileText, Loader2, Copy, Check, AlertCircle, Download, Database } from "lucide-react";
import { addToUserKnowledge } from "../utils/rag/ragQuery";

/**
 * PDF to Text Converter
 * Upload PDF files and extract text from them
 */
export default function PDFToText() {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [isAddingToRAG, setIsAddingToRAG] = useState(false);
  const [ragStatus, setRagStatus] = useState(null); // { success: boolean, message: string }
  const [useOCR, setUseOCR] = useState(false); // Toggle for OCR mode
  const [ocrProgress, setOcrProgress] = useState("");
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file");
      return;
    }

    // Check file size (limit to 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File size too large. Please select a PDF file smaller than 50MB");
      return;
    }

    setFile(selectedFile);
    setError("");
    setExtractedText("");
    setPageCount(0);
  };

  const extractTextFromPDF = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setIsExtracting(true);
    setError("");
    setExtractedText("");

    try {
      // Dynamically import pdf.js
      const pdfjsLib = await import("pdfjs-dist");
      
      // Set worker source - use local copy from public directory
      // This ensures it works offline and doesn't depend on CDN availability
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setPageCount(pdf.numPages);
      
      let fullText = "";
      let hasText = false;
      
      // Extract text from each page (for text-based PDFs)
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items
        const pageText = textContent.items
          .map((item) => item.str)
          .join(" ");
        
        if (pageText.trim()) {
          hasText = true;
        }
        
        fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
      }

      const extractedTextFromPDF = fullText.trim();
      
      // If no text found or useOCR is enabled, try OCR on images
      if (useOCR || (!hasText && (!extractedTextFromPDF || extractedTextFromPDF.length < 50))) {
        setOcrProgress("Extracting images from PDF for OCR...");
        
        // Extract images from PDF and run OCR
        let ocrText = "";
        const Tesseract = await import("tesseract.js");
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          setOcrProgress(`Processing page ${pageNum} of ${pdf.numPages} with OCR...`);
          
          const page = await pdf.getPage(pageNum);
          
          // Render page to canvas
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
          
          // Run OCR on the canvas
          try {
            const result = await Tesseract.recognize(canvas, "eng", {
              logger: (m) => {
                if (m.status === "recognizing text") {
                  setOcrProgress(`OCR page ${pageNum}: ${Math.round(m.progress * 100)}%`);
                }
              },
            });
            
            const pageOcrText = result.data.text.trim();
            if (pageOcrText) {
              ocrText += `--- Page ${pageNum} (OCR) ---\n${pageOcrText}\n\n`;
            }
          } catch (ocrErr) {
            console.error(`OCR error on page ${pageNum}:`, ocrErr);
          }
        }
        
        setOcrProgress("");
        
        // Combine PDF text and OCR text
        if (extractedTextFromPDF && extractedTextFromPDF.length > 0) {
          setExtractedText(extractedTextFromPDF + "\n\n--- OCR Results (from images) ---\n\n" + ocrText.trim());
        } else {
          setExtractedText(ocrText.trim() || "No text found in PDF (OCR also found no text)");
        }
      } else {
        setExtractedText(extractedTextFromPDF || "No text found in PDF");
      }
    } catch (err) {
      console.error("PDF extraction error:", err);
      let errorMessage = "Failed to extract text from PDF.";
      
      if (err.message?.includes("Invalid PDF")) {
        errorMessage = "Invalid PDF file. The file may be corrupted or password-protected.";
      } else if (err.message?.includes("password")) {
        errorMessage = "This PDF is password-protected. Please remove the password and try again.";
      } else if (err.message?.includes("worker")) {
        errorMessage = "Failed to load PDF.js worker. Please check your internet connection.";
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
    a.download = file ? file.name.replace(".pdf", ".txt") : "extracted-text.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddToRAG = async () => {
    if (!extractedText || !extractedText.trim()) {
      setRagStatus({
        success: false,
        message: "No text to add. Please extract text from PDF first.",
      });
      return;
    }

    setIsAddingToRAG(true);
    setRagStatus(null);
    setError("");

    try {
      const title = file 
        ? file.name.replace(".pdf", "")
        : `PDF Document ${new Date().toLocaleDateString()}`;
      
      const result = await addToUserKnowledge(title, extractedText, "pdf-upload");
      
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
    if (droppedFile && droppedFile.name.toLowerCase().endsWith(".pdf")) {
      if (droppedFile.size > 50 * 1024 * 1024) {
        setError("File size too large. Please select a PDF file smaller than 50MB");
        return;
      }
      setFile(droppedFile);
      setError("");
      setExtractedText("");
      setPageCount(0);
    } else {
      setError("Please drop a PDF file");
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
            PDF to Text Converter
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload PDF files and extract text from them. Works entirely in your browser - no data is sent to any server.
          </p>

          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center mb-6 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            {file ? (
              <div>
                <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                  {file.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={() => {
                    setFile(null);
                    setExtractedText("");
                    setPageCount(0);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Drag and drop a PDF file here, or
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select PDF File
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

          {/* OCR Mode Toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useOCR}
                onChange={(e) => setUseOCR(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Use OCR for image-based PDFs (scanned documents)
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              {useOCR 
                ? "Will extract text from images in PDF using OCR. Slower but works for scanned documents."
                : "Auto-detects: Uses OCR if no text is found. Check this to force OCR on all pages."}
            </p>
          </div>

          {/* Extract Button */}
          <button
            onClick={extractTextFromPDF}
            disabled={!file || isExtracting}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {ocrProgress || "Extracting text..."}
              </>
            ) : (
              "Extract Text from PDF"
            )}
          </button>

          {/* Page Count */}
          {pageCount > 0 && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
              Processed {pageCount} page{pageCount !== 1 ? "s" : ""}
            </p>
          )}

          {/* Extracted Text Display */}
          {extractedText && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Extracted Text
                </h2>
                <div className="flex gap-2">
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
                    onClick={handleDownload}
                    className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </button>
                  <button
                    onClick={handleAddToRAG}
                    disabled={isAddingToRAG}
                    className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    title="Add extracted text to Ask Joule knowledge base"
                  >
                    {isAddingToRAG ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-1" />
                        Add to RAG
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono">
                  {extractedText}
                </pre>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {extractedText.length} characters extracted
              </p>
            </div>
          )}

          {/* RAG Status Message */}
          {ragStatus && (
            <div className={`mt-6 p-4 rounded-md flex items-start ${
              ragStatus.success 
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" 
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            }`}>
              {ragStatus.success ? (
                <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${
                ragStatus.success 
                  ? "text-green-700 dark:text-green-300" 
                  : "text-red-700 dark:text-red-400"
              }`}>
                {ragStatus.message}
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
              <strong>Privacy:</strong> All processing happens in your browser. No files are uploaded to any server. 
              Maximum file size: 50MB. Password-protected PDFs are not supported. 
              Complex layouts or scanned PDFs may not extract perfectly.
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Add to RAG:</strong> Click "Add to RAG" to add the extracted text to Ask Joule's knowledge base. 
              The content will be stored locally in your browser and can be queried by Ask Joule. 
              You can add up to 100 documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

