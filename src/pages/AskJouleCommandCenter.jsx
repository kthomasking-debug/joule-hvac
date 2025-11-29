import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { FileText, Download, Trash2, RotateCcw, ArrowRight } from 'lucide-react';

const downloadFile = (filename, content) => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const csvFromAudit = (items) => {
  const header = ['timestamp', 'key', 'oldValue', 'newValue', 'source', 'comment'];
  const rows = items.map(i => [i.timestamp, i.key, JSON.stringify(i.oldValue), JSON.stringify(i.newValue), i.source || '', i.comment || '']);
  return [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
};

const AskJouleCommandCenter = () => {
  const outlet = useOutletContext() || {};
  const auditLog = outlet.auditLog || [];
  const undoChange = outlet.undoChange;
  const clearAuditLog = outlet.clearAuditLog;

  return (
    <div className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Ask Joule Command Center</h1>
        <Link to="/settings" className="text-sm text-blue-600 hover:underline flex items-center gap-2">Back to Settings <ArrowRight size={14} /></Link>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-blue-600" />
            <div>
              <div className="font-semibold">Command history</div>
              <div className="text-xs text-gray-600">Recorded Ask Joule changes across your device</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-outline" onClick={() => {
              const json = JSON.stringify(auditLog || [], null, 2);
              downloadFile('ask-joule-audit.json', json);
            }}><Download size={16} className="inline mr-2" />Export JSON</button>
            <button className="btn btn-outline" onClick={() => {
              const csv = csvFromAudit(auditLog || []);
              downloadFile('ask-joule-audit.csv', csv);
            }}><Download size={16} className="inline mr-2" />Export CSV</button>
            <button className="btn btn-ghost text-red-600" onClick={() => { if (clearAuditLog) clearAuditLog(); }}><Trash2 size={14} /> Clear</button>
          </div>
        </div>

        <div className="border-t pt-4">
          {(!auditLog || auditLog.length === 0) ? (
            <div className="text-sm text-gray-600">No audit entries found.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLog.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded border hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex-1">
                    <div className="text-sm"><strong>{new Date(item.timestamp).toLocaleString()}</strong> • <span className="font-semibold">{item.key}</span> → <span className="text-gray-700 dark:text-gray-200">{JSON.stringify(item.newValue)}</span></div>
                    <div className="text-xs text-gray-500">{item.source || 'ui'} {item.comment ? `• ${item.comment}` : ''}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button className="btn btn-outline btn-sm" onClick={() => { if (undoChange) undoChange(item.id); }}>Undo</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AskJouleCommandCenter;
