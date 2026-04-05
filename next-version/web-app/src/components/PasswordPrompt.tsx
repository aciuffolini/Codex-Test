/**
 * Password Prompt Component
 * Protects app access with password authentication
 * Uses SHA-256 hashing for secure password validation
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { validatePassword } from '../lib/config/password';

interface PasswordPromptProps {
  onSuccess: () => void;
}

export function PasswordPrompt({ onSuccess }: PasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    
    try {
      // Validate password using hash comparison
      const isValid = await validatePassword(password);
      
      if (isValid) {
        // Store authentication in sessionStorage
        sessionStorage.setItem('app_authenticated', 'true');
        sessionStorage.setItem('auth_timestamp', Date.now().toString());
        onSuccess();
      } else {
        setAttempts(prev => prev + 1);
        setError('Contraseña incorrecta. Intenta nuevamente.');
        setPassword('');
        
        // Block after 5 failed attempts
        if (attempts >= 4) {
          setError('Demasiados intentos fallidos. Cierra la app e intenta de nuevo.');
        }
      }
    } catch (err) {
      console.error('[PasswordPrompt] Validation error:', err);
      setError('Error al validar contraseña. Intenta nuevamente.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md mx-4"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🌾</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Farm Visit App
              </h1>
              <p className="text-sm text-slate-600">
                Ingresa la contraseña para acceder
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Ingresa la contraseña"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                  disabled={attempts >= 5}
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg"
                >
                  {error}
                  {attempts >= 4 && (
                    <div className="mt-2 text-xs">
                      Intentos: {attempts + 1}/5
                    </div>
                  )}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={!password.trim() || attempts >= 5 || isValidating}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? 'Validando...' : attempts >= 5 ? 'Bloqueado' : 'Acceder'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-500">
                Para permisos y acceso: <a href="mailto:aciuffolini@teknal.com.ar" className="text-emerald-600 hover:underline">aciuffolini@teknal.com.ar</a>
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
