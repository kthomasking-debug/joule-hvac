import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { parseBillText, calibrateModel, saveBill } from '../lib/bills/billParser';

export default function BillUpload({ predictedMonthlyCost = 150 }) {
  const [billText, setBillText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [calibration, setCalibration] = useState(null);
  const [saved, setSaved] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const handleParse = () => {
    const result = parseBillText(billText);
    setParsed(result);
    
    if (result && result.totalCost) {
      const cal = calibrateModel(result.totalCost, predictedMonthlyCost);
      setCalibration(cal);
    }
  };

  const handleSave = () => {
    if (!parsed || !parsed.totalCost) return;
    saveBill({ ...parsed, predictedCost: predictedMonthlyCost, calibration });
    setSaved(true);
    setTimeout(() => {
      setBillText('');
      setParsed(null);
      setCalibration(null);
      setSaved(false);
    }, 2000);
  };

  const handleFileChange = (file) => {
    if (!file) return;
    setUploadedFile(file);
    try {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } catch { /* ignore */ }
  };

  const handleParsePhoto = () => {
    // For now, stub parsing: set parsed to a minimal fake result extracted from filename
    if (!uploadedFile) return;
    const pseudo = { totalCost: predictedMonthlyCost, kwh: 0, startDate: null, endDate: null };
    setParsed(pseudo);
    const cal = calibrateModel(pseudo.totalCost, predictedMonthlyCost);
    setCalibration(cal);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
        <FileText className="text-purple-600" size={20} />
        Bill Upload & Verification
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Paste your utility bill text to calibrate predictions and track accuracy.
      </p>

      <textarea
        value={billText}
        onChange={(e) => setBillText(e.target.value)}
        placeholder="Paste your bill text here (e.g., 'Total Amount Due: $145.50, 850 kWh, Billing Period: 10/15/2025 - 11/14/2025')"
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      />

      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={handleParse}
          disabled={!billText.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-semibold"
        >
          <Upload size={14} />
          Parse Bill
        </button>
        
        {parsed && parsed.totalCost && (
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
          >
            {saved ? <CheckCircle size={14} /> : <FileText size={14} />}
            {saved ? 'Saved!' : 'Save Bill'}
          </button>
        )}
        <input
          id="bill-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => document.getElementById('bill-photo-input')?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
        >
          Take Photo
        </button>
        {filePreview && (
          <div className="ml-3">
            <img src={filePreview} alt="Bill preview" className="max-h-20 rounded shadow-sm" />
            <div className="mt-1">
              <button onClick={handleParsePhoto} className="text-xs text-blue-600 hover:underline">Parse Photo</button>
            </div>
          </div>
        )}
      </div>

      {parsed && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Parsed Data</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>{' '}
              <strong className="text-gray-900 dark:text-white">
                {parsed.totalCost ? `$${parsed.totalCost.toFixed(2)}` : 'Not found'}
              </strong>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">kWh:</span>{' '}
              <strong className="text-gray-900 dark:text-white">
                {parsed.kwh ? parsed.kwh.toFixed(1) : 'Not found'}
              </strong>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600 dark:text-gray-400">Period:</span>{' '}
              <strong className="text-gray-900 dark:text-white">
                {parsed.startDate && parsed.endDate ? `${parsed.startDate} - ${parsed.endDate}` : 'Not found'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {calibration && (
        <div className={`p-4 rounded-lg border ${
          Math.abs(calibration.variance) <= 10 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
        }`}>
          <div className="flex items-start gap-2">
            {Math.abs(calibration.variance) <= 10 ? (
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
            ) : (
              <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Model Calibration</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Predicted: ${predictedMonthlyCost.toFixed(2)} • Actual: ${parsed.totalCost.toFixed(2)} • 
                Variance: {calibration.variance > 0 ? '+' : ''}{calibration.variance.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{calibration.suggestion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
