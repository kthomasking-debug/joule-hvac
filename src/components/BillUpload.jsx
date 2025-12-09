import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { parseBillText, calibrateModel, saveBill } from '../lib/bills/billParser';

export default function BillUpload({ predictedMonthlyCost = 150 }) {
  const [billText, setBillText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [calibration, setCalibration] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const handleParse = () => {
    setError(null);
    setSaved(false);
    
    if (!billText.trim()) {
      setError('Please paste your bill text first.');
      return;
    }
    
    try {
      const result = parseBillText(billText);
      
      if (!result || !result.totalCost) {
        setParsed(result || null);
        setCalibration(null);
        setError('I could not find a total dollar amount in that text. Try pasting the "Amount Due" section of your bill.');
        return;
      }
      
      setParsed(result);
      const cal = calibrateModel(result.totalCost, predictedMonthlyCost);
      setCalibration(cal);
    } catch (e) {
      console.error('Bill parsing error:', e);
      setParsed(null);
      setCalibration(null);
      setError('Sorry, something went wrong while parsing this bill. Please try again or check the format.');
    }
  };

  const handleSave = async () => {
    if (!parsed || !parsed.totalCost || saving) return;
    
    setSaving(true);
    setError(null);
    
    try {
      saveBill({ ...parsed, predictedCost: predictedMonthlyCost, calibration });
      setSaved(true);
      
      // Clear only the text input and saved state after a delay, keep parsed data visible
      setTimeout(() => {
        setBillText('');
        setSaved(false);
      }, 2000);
    } catch (e) {
      console.error('Save error:', e);
      setError('Failed to save bill. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (file) => {
    if (!file) return;
    setUploadedFile(file);
    setError(null);
    try {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } catch { /* ignore */ }
  };

  const handleParsePhoto = () => {
    if (!uploadedFile) return;
    
    // Photo parsing is not ready yet - show clear message
    setError('Photo parsing is not ready yet. For now, paste the text from your bill instead.');
    setParsed(null);
    setCalibration(null);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
        <FileText className="text-purple-600" size={20} />
        Bill Upload & Verification
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Paste your electric bill. Joule will compare it to the physics model and tell you if something doesn't add up.
      </p>

      <textarea
        value={billText}
        onChange={(e) => {
          setBillText(e.target.value);
          setError(null); // Clear error when user types
        }}
        placeholder="Paste your bill text here (e.g., 'Total Amount Due: $145.50, 850 kWh, Billing Period: 10/15/2025 - 11/14/2025')"
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      />

      {/* Error message */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={16} />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

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
            disabled={saving || saved}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold"
          >
            {saved ? <CheckCircle size={14} /> : <FileText size={14} />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Bill'}
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
          Take Photo <span className="text-[11px] ml-1 opacity-70">(beta)</span>
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
              <span className="text-gray-600 dark:text-gray-400">Total Bill (electric only):</span>{' '}
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
              <span className="text-gray-600 dark:text-gray-400">Billing Period:</span>{' '}
              <strong className="text-gray-900 dark:text-white">
                {parsed.startDate && parsed.endDate ? `${parsed.startDate} - ${parsed.endDate}` : 'Not found'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {calibration && parsed?.totalCost != null && (
        <div className={`p-4 rounded-lg border ${
          Math.abs(calibration.variance) <= 10 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
        }`}>
          <div className="flex items-start gap-2">
            {Math.abs(calibration.variance) <= 10 ? (
              <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={18} />
            ) : (
              <AlertCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={18} />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Model Calibration</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Predicted: ${predictedMonthlyCost.toFixed(2)} • Actual: ${parsed.totalCost.toFixed(2)} • 
                Variance: {calibration.variance > 0 ? '+' : ''}{calibration.variance.toFixed(1)}%
              </p>
              {Math.abs(calibration.variance) <= 10 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You're within <strong>±10%</strong>. The simulation and your bill agree pretty well.
                </p>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  We're off by <strong>{calibration.variance > 0 ? '+' : ''}{calibration.variance.toFixed(1)}%</strong>. {calibration.suggestion}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
