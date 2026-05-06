import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-white dark:bg-dark-card dark:text-gray-100 p-8 rounded-[32px] shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto transform transition-all scale-100 border border-gray-100 dark:border-slate-800 relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center z-10"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
