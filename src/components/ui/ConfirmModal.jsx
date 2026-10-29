import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/admin.css';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Delete', cancelText = 'Cancel', type = 'danger' }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="admin-modal-overlay" style={{ zIndex: 99999 }}>
          <motion.div
            className="admin-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="admin-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {type === 'danger' && <AlertTriangle size={18} color="#ef4444" />}
                <h3 className="admin-modal__title" style={{ margin: 0, color: type === 'danger' ? '#ef4444' : '#fff' }}>
                  {title || 'Confirm Action'}
                </h3>
              </div>
              <button className="admin-modal__close" onClick={onCancel}>
                <X size={18} />
              </button>
            </div>
            
            <div className="admin-modal__body" style={{ padding: '1.5rem', color: '#ccc', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {message}
            </div>
            
            <div className="admin-modal__footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e1e1e', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#0a0a0a' }}>
              <button className="admin-btn admin-btn--secondary" onClick={onCancel}>
                {cancelText}
              </button>
              <button 
                className={`admin-btn ${type === 'danger' ? 'admin-btn--danger' : 'admin-btn--primary'}`} 
                onClick={onConfirm}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
