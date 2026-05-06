import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { supabase } from '../utils/supabase';
import { DocumentationSection } from '../types';

export const DocumentationView: React.FC = () => {
    const { docSections, setDocSections, docLinks, setDocLinks, showToast, currentUserMember } = useApp();
    const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    // Navigation State
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [newSection, setNewSection] = useState({ title: '', parentId: null as string | null });
    const [newLink, setNewLink] = useState({ title: '', url: '', description: '', sectionId: '' });

    const handleAddSection = async () => {
        if (!newSection.title) return showToast('Ingrese un título', 'error');
        try {
            const parentId = currentFolderId; // Active folder is parent
            const { data, error } = await supabase.from('documentation_sections').insert([{
                title: newSection.title,
                parent_id: parentId,
                order: docSections.filter(s => s.parentId === parentId).length
            }]).select();

            if (error) throw error;

            setDocSections(prev => [...prev, {
                id: data[0].id,
                title: data[0].title,
                parentId: data[0].parent_id,
                order: data[0].order
            }]);

            setIsSectionModalOpen(false);
            setNewSection({ title: '', parentId: null });
            showToast('Carpeta creada', 'success');
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleAddLink = async () => {
        if (!newLink.title || !newLink.url || !currentFolderId) return showToast('Complete los campos', 'error');
        try {
            const { data, error } = await supabase.from('documentation_links').insert([{
                title: newLink.title,
                url: newLink.url,
                description: newLink.description,
                section_id: currentFolderId
            }]).select();

            if (error) throw error;

            setDocLinks(prev => [...prev, {
                id: data[0].id,
                sectionId: data[0].section_id,
                title: data[0].title,
                url: data[0].url,
                description: data[0].description,
                createdAt: data[0].created_at
            }]);

            setIsLinkModalOpen(false);
            setNewLink({ title: '', url: '', description: '', sectionId: '' });
            showToast('Enlace agregado', 'success');
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const deleteSection = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!window.confirm('¿Eliminar esta carpeta y todo su contenido (subcarpetas y enlaces)?')) return;
        try {
            const { error } = await supabase.from('documentation_sections').delete().eq('id', id);
            if (error) throw error;

            // Local state cleanup (recursive logic handled by DB cascade delete usually, but let's sync state)
            const idsToDelete = [id];
            const findSubIds = (pid: string) => {
                docSections.filter(s => s.parentId === pid).forEach(s => {
                    idsToDelete.push(s.id);
                    findSubIds(s.id);
                });
            };
            findSubIds(id);

            setDocSections(prev => prev.filter(s => !idsToDelete.includes(s.id)));
            setDocLinks(prev => prev.filter(l => !idsToDelete.includes(l.sectionId)));

            if (currentFolderId === id) setCurrentFolderId(null);

            showToast('Carpeta eliminada', 'info');
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const deleteLink = async (id: string) => {
        if (!window.confirm('¿Eliminar este enlace?')) return;
        try {
            const { error } = await supabase.from('documentation_links').delete().eq('id', id);
            if (error) throw error;
            setDocLinks(prev => prev.filter(l => l.id !== id));
            showToast('Enlace eliminado', 'info');
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    // Filter current view content
    const currentSubfolders = useMemo(() =>
        docSections.filter(s => s.parentId === currentFolderId)
        , [docSections, currentFolderId]);

    const currentLinks = useMemo(() =>
        docLinks.filter(l => l.sectionId === currentFolderId)
        , [docLinks, currentFolderId]);

    // Breadcrumb calculation
    const breadcrumbs = useMemo(() => {
        const path: DocumentationSection[] = [];
        let folderId = currentFolderId;
        while (folderId) {
            const folder = docSections.find(s => s.id === folderId);
            if (folder) {
                path.unshift(folder);
                folderId = folder.parentId;
            } else {
                folderId = null;
            }
        }
        return path;
    }, [docSections, currentFolderId]);

    const currentFolderName = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].title : 'Raíz';

    // Global Search Results
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const query = searchQuery.toLowerCase();

        const filteredFolders = docSections.filter(s => s.title.toLowerCase().includes(query));
        const filteredLinks = docLinks.filter(l =>
            l.title.toLowerCase().includes(query) ||
            (l.description && l.description.toLowerCase().includes(query))
        );

        return { folders: filteredFolders, links: filteredLinks };
    }, [docSections, docLinks, searchQuery]);

    return (
        <div className="fade-in max-w-6xl mx-auto pb-20">
            {/* Header with Navigation */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs font-black text-blue-500 uppercase tracking-widest mb-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                        <button onClick={() => setCurrentFolderId(null)} className="hover:underline">DOCUMENTACIÓN</button>
                        {breadcrumbs.map((b, idx) => (
                            <React.Fragment key={b.id}>
                                <i className="fas fa-chevron-right text-[8px] text-gray-300"></i>
                                <button
                                    onClick={() => setCurrentFolderId(b.id)}
                                    className={`hover:underline ${idx === breadcrumbs.length - 1 ? 'text-gray-400' : ''}`}
                                >
                                    {b.title}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <h2 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                            <i className={`fas ${currentFolderId ? 'fa-folder-open text-blue-500' : 'fa-home text-blue-400'}`}></i>
                            {searchQuery ? 'Resultados de búsqueda' : currentFolderName}
                        </h2>

                        <div className="relative flex-1 max-w-md w-full">
                            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input
                                type="text"
                                placeholder="Buscar en toda la documentación..."
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold text-sm dark:text-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setIsSectionModalOpen(true)}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/20 transition-all font-bold flex items-center gap-2 active:scale-95 text-sm"
                    >
                        <i className="fas fa-folder-plus"></i> Nueva Carpeta
                    </button>
                    {currentFolderId && (
                        <button
                            onClick={() => setIsLinkModalOpen(true)}
                            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-500/20 transition-all font-bold flex items-center gap-2 active:scale-95 text-sm"
                        >
                            <i className="fas fa-link"></i> Agregar Enlace
                        </button>
                    )}
                </div>
            </div>

            {/* Folders Grid */}
            <div className={`mb-10 ${searchQuery && searchResults?.folders.length === 0 ? 'hidden' : ''}`}>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-2">
                    {searchQuery ? 'Carpetas encontradas' : 'Carpetas / Temas'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(searchQuery ? searchResults?.folders : currentSubfolders)?.map(folder => (
                        <div
                            key={folder.id}
                            onClick={() => setCurrentFolderId(folder.id)}
                            className="bg-white dark:bg-dark-card p-5 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]"
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl">
                                    <i className="fas fa-folder text-blue-500 text-xl"></i>
                                </div>
                                <button
                                    onClick={(e) => deleteSection(folder.id, e)}
                                    className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <i className="fas fa-trash-alt text-xs"></i>
                                </button>
                            </div>
                            <div className="mt-4">
                                <h4 className="font-black text-gray-800 dark:text-white leading-tight mb-1">{folder.title}</h4>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">
                                    {docSections.filter(s => s.parentId === folder.id).length} Carpetas · {docLinks.filter(l => l.sectionId === folder.id).length} Enlaces
                                </p>
                            </div>
                        </div>
                    ))}

                    {/* Empty Folder State */}
                    {currentSubfolders.length === 0 && !currentFolderId && (
                        <div className="col-span-full py-16 text-center bg-gray-50/50 dark:bg-slate-800/20 rounded-[40px] border-2 border-dashed border-gray-100 dark:border-slate-800">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-300">
                                <i className="fas fa-layer-group fa-2x"></i>
                            </div>
                            <p className="text-gray-400 font-bold text-sm">No hay carpetas generales aún.</p>
                            <button onClick={() => setIsSectionModalOpen(true)} className="mt-4 text-blue-500 font-black text-xs uppercase hover:underline">Crear primera carpeta</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Links Section */}
            {(currentFolderId || searchQuery) && (
                <div className={`mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500 ${searchQuery && searchResults?.links.length === 0 ? 'hidden' : ''}`}>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-2">
                        {searchQuery ? 'Enlaces encontrados' : 'Documentos y Enlaces'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(searchQuery ? searchResults?.links : currentLinks)?.map(link => (
                            <div key={link.id} className="bg-white dark:bg-dark-card p-5 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-md transition-all group flex items-center justify-between">
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 flex-1 overflow-hidden"
                                >
                                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center shrink-0">
                                        <i className="fas fa-file-alt text-indigo-500"></i>
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="font-bold text-gray-800 dark:text-white truncate">{link.title}</h4>
                                        {link.description && <p className="text-xs text-gray-400 truncate">{link.description}</p>}
                                        <p className="text-[9px] font-mono text-blue-400 mt-1 truncate">{link.url}</p>
                                    </div>
                                </a>
                                <button
                                    onClick={() => deleteLink(link.id)}
                                    className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        ))}

                        {currentLinks.length === 0 && (
                            <div className="col-span-full py-12 text-center">
                                <i className="fas fa-unlink text-gray-200 dark:text-slate-800 text-3xl mb-3"></i>
                                <p className="text-xs text-gray-400 font-medium italic">Esta carpeta no contiene enlaces directos aún.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal para Nueva Sección */}
            <Modal isOpen={isSectionModalOpen} onClose={() => setIsSectionModalOpen(false)}>
                <div className="p-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-500">
                            <i className="fas fa-folder-plus text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black dark:text-white">Nueva Carpeta</h3>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Dentro de: {currentFolderName}</p>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 ml-1">Nombre de la Carpeta</label>
                            <input
                                type="text"
                                className="w-full h-14 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 transition-all font-bold text-sm"
                                placeholder="Ej: Procesos de Calidad"
                                value={newSection.title}
                                onChange={e => setNewSection({ ...newSection, title: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t dark:border-slate-800">
                            <button onClick={() => setIsSectionModalOpen(false)} className="px-6 py-2.5 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                            <button onClick={handleAddSection} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl shadow-lg shadow-blue-500/20 font-black transition-all active:scale-95">
                                CREAR CARPETA
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal para Nuevo Enlace */}
            <Modal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)}>
                <div className="p-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-500">
                            <i className="fas fa-link text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black dark:text-white">Añadir Documento</h3>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">En carpeta: {currentFolderName}</p>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 ml-1">Título del Documento</label>
                            <input
                                type="text"
                                className="w-full h-14 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 transition-all font-bold text-sm"
                                placeholder="Ej: Guía de Usuario - VPN"
                                value={newLink.title}
                                onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 ml-1">URL / Link</label>
                            <input
                                type="text"
                                className="w-full h-14 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 transition-all font-bold font-mono text-sm"
                                placeholder="https://..."
                                value={newLink.url}
                                onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 ml-1">Descripción (Opcional)</label>
                            <textarea
                                className="w-full h-24 px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 transition-all font-bold text-sm resize-none"
                                placeholder="..."
                                value={newLink.description}
                                onChange={e => setNewLink({ ...newLink, description: e.target.value })}
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t dark:border-slate-800">
                            <button onClick={() => setIsLinkModalOpen(false)} className="px-6 py-2.5 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                            <button onClick={handleAddLink} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl shadow-lg shadow-indigo-500/20 font-black transition-all active:scale-95">
                                GUARDAR ENLACE
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
