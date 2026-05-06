import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../utils/supabase';

export const ProfileView: React.FC = () => {
    const { user, showToast } = useApp();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password || !confirmPassword) {
            return showToast('Por favor, complete ambos campos', 'error');
        }

        if (password !== confirmPassword) {
            return showToast('Las contraseñas no coinciden', 'error');
        }

        if (password.length < 6) {
            return showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            showToast('Contraseña actualizada correctamente', 'success');
            setPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            showToast('Error al actualizar contraseña: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-in max-w-2xl mx-auto py-8">
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-gray-100 dark:border-dark-border overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                            <i className="fas fa-user text-3xl"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Perfil de Usuario</h2>
                            <p className="text-indigo-100 opacity-80">{user?.email}</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="mb-8">
                        <h3 className="text-lg font-bold dark:text-white mb-2 flex items-center gap-2">
                            <i className="fas fa-lock text-indigo-500"></i>
                            Seguridad
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Actualiza tu contraseña para mantener tu cuenta segura.
                        </p>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block ml-1">Nueva Contraseña</label>
                            <div className="relative">
                                <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input
                                    type="password"
                                    className="input-field pl-12"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block ml-1">Confirmar Contraseña</label>
                            <div className="relative">
                                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input
                                    type="password"
                                    className="input-field pl-12"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
                                    ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}
                                `}
                            >
                                {loading ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i>
                                        Actualizando...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save"></i>
                                        Actualizar Contraseña
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="mt-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-6 rounded-2xl flex gap-4">
                <i className="fas fa-exclamation-triangle text-amber-500 text-xl flex-shrink-0 mt-1"></i>
                <div>
                    <h4 className="font-bold text-amber-800 dark:text-amber-400">Importante</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-500/80 leading-relaxed">
                        Al cambiar tu contraseña, asegúrate de utilizar una combinación fuerte de letras, números y símbolos. Recuerda que la próxima vez que inicies sesión deberás utilizar la nueva contraseña.
                    </p>
                </div>
            </div>
        </div>
    );
};
