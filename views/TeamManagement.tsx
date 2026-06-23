import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../utils/supabase';
import { TeamMember } from '../types';

const ADMIN_EMAIL = 'pedro.sequeira@bghtechpartner.com';

export const TeamManagementView: React.FC = () => {
  const { user, team, refreshData, showToast } = useApp();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', role: '', capacity_id: '' });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <i className="fas fa-lock text-5xl text-gray-400 dark:text-gray-600"></i>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Acceso Restringido</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          No tenés permisos para acceder a esta sección. Por favor, contactá al administrador.
        </p>
        <a href="mailto:pedro.sequeira@bghtechpartner.com" className="text-blue-500 hover:underline">
          pedro.sequeira@bghtechpartner.com
        </a>
      </div>
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('team_members').insert({
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role.trim(),
        capacity_id: formData.capacity_id.trim() || null,
      });
      if (error) throw error;
      showToast('Recurso agregado exitosamente', 'success');
      setShowAddModal(false);
      setFormData({ name: '', email: '', role: '' });
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al agregar recurso', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ name: formData.name.trim(), email: formData.email.trim(), role: formData.role.trim(), capacity_id: formData.capacity_id.trim() || null })
        .eq('id', editingMember.id);
      if (error) throw error;
      showToast('Recurso actualizado exitosamente', 'success');
      setShowEditModal(false);
      setEditingMember(null);
      setFormData({ name: '', email: '', role: '' });
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar recurso', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (member: TeamMember) => {
    if (!window.confirm(`¿Estás seguro de que querés eliminar a ${member.name}?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', member.id);
      if (error) throw error;
      showToast('Recurso eliminado exitosamente', 'success');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar recurso', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({ name: member.name, email: member.email || '', role: member.role, capacity_id: member.capacity_id || '' });
    setShowEditModal(true);
  };

  const sortedTeam = [...team].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestión de Recursos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {team.length} recurso{team.length !== 1 ? 's' : ''} registrado{team.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setFormData({ name: '', email: '', role: '' }); setShowAddModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          <i className="fas fa-plus"></i> Nuevo Recurso
        </button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-1">
          <i className="fas fa-info-circle"></i> Nota sobre autenticación
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Para que un recurso pueda iniciar sesión, también debés crear su usuario en el{' '}
          <strong>Dashboard de Supabase → Authentication → Users → Add User</strong> con el mismo email y una contraseña inicial.
        </p>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow border border-gray-200 dark:border-dark-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID Empresa</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
            {sortedTeam.map(member => (
              <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-sm flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800 dark:text-white">{member.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300 text-sm">{member.email || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {member.capacity_id
                    ? <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{member.capacity_id}</span>
                    : <span className="text-gray-400 text-sm">—</span>
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => openEdit(member)}
                    className="text-blue-500 hover:text-blue-700 mr-4 transition-colors"
                    title="Editar"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(member)}
                    disabled={loading}
                    className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                    title="Eliminar"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
            {team.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No hay recursos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b dark:border-dark-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Nuevo Recurso</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="juan.perez@bghtechpartner.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                <input
                  type="text"
                  required
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Ingeniero/a, PM, Analista"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ID Empresa <span className="text-gray-400 font-normal">(número de alta en la empresa)</span>
                </label>
                <input
                  type="text"
                  value={formData.capacity_id}
                  onChange={e => setFormData(prev => ({ ...prev, capacity_id: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 369"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 font-medium"
                >
                  {loading ? 'Guardando...' : 'Agregar Recurso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b dark:border-dark-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Editar Recurso</h2>
              <button onClick={() => { setShowEditModal(false); setEditingMember(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                <input
                  type="text"
                  required
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ID Empresa <span className="text-gray-400 font-normal">(número de alta en la empresa)</span>
                </label>
                <input
                  type="text"
                  value={formData.capacity_id}
                  onChange={e => setFormData(prev => ({ ...prev, capacity_id: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 369"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingMember(null); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 font-medium"
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
