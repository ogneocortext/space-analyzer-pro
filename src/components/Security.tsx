import React from 'react';
import { Shield, AlertTriangle, Lock, FileX, Eye, CheckCircle } from 'lucide-react';

interface SecurityProps {
  analysisData?: any;
}

export const Security: React.FC<SecurityProps> = ({ analysisData }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-400" />
          Security Analysis
        </h1>
        <p className="text-slate-400 text-lg">
          Comprehensive security scanning and risk assessment for your files
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h3 className="text-lg font-semibold text-white">High Risk</h3>
          </div>
          <div className="text-3xl font-bold text-red-400 mb-2">3</div>
          <p className="text-slate-400 text-sm">Critical security issues</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileX className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">Suspicious Files</h3>
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-2">12</div>
          <p className="text-slate-400 text-sm">Files requiring review</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Encrypted</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">89%</div>
          <p className="text-slate-400 text-sm">Files properly secured</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Scanned</h3>
          </div>
          <div className="text-3xl font-bold text-blue-400 mb-2">100%</div>
          <p className="text-slate-400 text-sm">Complete security scan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Security Alerts
          </h2>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className="text-red-400 font-medium mb-1">Executable Files in Documents</h4>
                  <p className="text-slate-300 text-sm">
                    Found executable files disguised as documents in your Documents folder.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className="text-orange-400 font-medium mb-1">Unencrypted Sensitive Files</h4>
                  <p className="text-slate-300 text-sm">
                    Personal documents and financial files are not encrypted.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className="text-yellow-400 font-medium mb-1">Outdated File Permissions</h4>
                  <p className="text-slate-300 text-sm">
                    Some files have overly permissive access rights.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Security Score
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Overall Security</span>
                <span className="text-green-400 font-medium">87%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div className="bg-green-400 h-3 rounded-full" style={{ width: '87%' }}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">A+</div>
                <div className="text-sm text-slate-400">Grade</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">256</div>
                <div className="text-sm text-slate-400">Files Scanned</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">File Permissions</span>
                <span className="text-green-400">✓ Secure</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Encryption</span>
                <span className="text-green-400">✓ Active</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Malware Scan</span>
                <span className="text-green-400">✓ Clean</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Security;