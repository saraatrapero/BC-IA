import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../lib/firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { GlobalConfig, CatalogProduct, BrandLogistics, ColdEquipment, FixedCost, MaintenanceCost, CapillaryRule, UserProfile, UserRole, BusinessCase, CoraTrainingRule } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { 
  Save, Loader2, DollarSign, Truck, Package, Percent, Settings2, Info, 
  Trash2, Plus, MapPin, Wind, Wrench, Home, Search,
  ChevronRight, Download, Upload, FileText, CheckSquare, Square, ShieldAlert,
  Users, FolderOpen, Folder, Calendar, Eye, ArrowLeft, X, Brain, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

type AdminTab = 'config' | 'materials' | 'transport' | 'cooling' | 'maintenance' | 'fixed_costs' | 'users' | 'cases' | 'cora_training';

interface AdminPanelProps {
  onViewCase?: (id: string) => void;
}

export default function AdminPanel({ onViewCase }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('config');

  useEffect(() => {
    const handleSetAdminTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as AdminTab);
      }
    };
    window.addEventListener('set-admin-tab', handleSetAdminTab);
    return () => {
      window.removeEventListener('set-admin-tab', handleSetAdminTab);
    };
  }, []);
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [isAdminUser, setIsAdminUser] = useState(false);
  
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [brandLogistics, setBrandLogistics] = useState<BrandLogistics[]>([]);
  const [coolingEquipment, setCoolingEquipment] = useState<ColdEquipment[]>([]);
  const [maintenanceCosts, setMaintenanceCosts] = useState<MaintenanceCost[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [capillaryRules, setCapillaryRules] = useState<CapillaryRule[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchTermMaterials, setSearchTermMaterials] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTermUsers, setSearchTermUsers] = useState('');
  const [allCases, setAllCases] = useState<BusinessCase[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [searchTermCases, setSearchTermCases] = useState('');
  const [coraTraining, setCoraTraining] = useState<CoraTrainingRule[]>([]);
  const [searchTermCora, setSearchTermCora] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserProfile, setEditingUserProfile] = useState<Partial<UserProfile> | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');

  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.currentUser) {
        console.log('No user logged in');
        return;
      }
      
      const email = auth.currentUser.email?.toLowerCase();
      const isBootstrapAdmin = email === 'jtrapero2013@gmail.com';
      console.log('Checking admin for:', email, 'isBootstrapAdmin:', isBootstrapAdmin);
      
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const profilData = userDoc.data() as UserProfile;
          const hasAdminRole = profilData.role === UserRole.ADMIN;
          setIsAdminUser(hasAdminRole || isBootstrapAdmin);
          console.log('Profile found:', profilData.role, 'Final isAdminUser:', hasAdminRole || isBootstrapAdmin);
        } else {
          setIsAdminUser(isBootstrapAdmin);
          console.log('No profile found, defaulting to boostrap admin status:', isBootstrapAdmin);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setIsAdminUser(isBootstrapAdmin);
      }
    };
    checkAdmin();

    const unsubConfig = onSnapshot(doc(db, 'configs', 'global'), (snap) => {
      if (snap.exists()) setConfig(snap.data() as GlobalConfig);
      else setDoc(doc(db, 'configs', 'global'), DEFAULT_CONFIG);
      setLoading(false);
    });

    const unsubProducts = onSnapshot(collection(db, 'catalogProducts'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogProduct)));
    });

    const unsubBrandLog = onSnapshot(collection(db, 'brandLogistics'), (snap) => {
      setBrandLogistics(snap.docs.map(d => ({ id: d.id, ...d.data() } as BrandLogistics)));
    });

    const unsubCooling = onSnapshot(collection(db, 'coldEquipment'), (snap) => {
      setCoolingEquipment(snap.docs.map(d => ({ id: d.id, ...d.data() } as ColdEquipment)));
    });

    const unsubMaint = onSnapshot(collection(db, 'maintenanceCosts'), (snap) => {
      setMaintenanceCosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceCost)));
    });

    const unsubFixed = onSnapshot(collection(db, 'fixedCosts'), (snap) => {
      setFixedCosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as FixedCost)));
    });

    const unsubCapillary = onSnapshot(collection(db, 'capillaryRules'), (snap) => {
      setCapillaryRules(snap.docs.map(d => ({ id: d.id, ...d.data() } as CapillaryRule)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    }, (err) => {
      console.warn('Error loading users or permission denied:', err);
    });

    const unsubCases = onSnapshot(collection(db, 'businessCases'), (snap) => {
      setAllCases(snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessCase)));
    }, (err) => {
      console.warn('Error loading cases or permission denied:', err);
    });

    const unsubCora = onSnapshot(collection(db, 'coraTraining'), (snap) => {
      setCoraTraining(snap.docs.map(d => ({ id: d.id, ...d.data() } as CoraTrainingRule)));
    }, (err) => {
      console.warn('Error loading coraTraining:', err);
    });

    return () => {
      unsubConfig(); unsubProducts(); unsubBrandLog();
      unsubCooling(); unsubMaint(); unsubFixed();
      unsubCapillary(); unsubUsers(); unsubCases();
      unsubCora();
    };
  }, []);

  const handleGlobalSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'configs', 'global'), config);
      setMessage({ type: 'success', text: 'Configuración global guardada.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error al guardar configuración.' });
    } finally {
      setTimeout(() => setMessage(null), 3000);
      setSaving(false);
    }
  };

  const addItem = async (col: string, data: any) => {
    try {
      await addDoc(collection(db, col), data);
      setMessage({ type: 'success', text: 'Elemento añadido.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error al añadir elemento.' });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const updateItem = async (col: string, id: string, data: any) => {
    try {
      const { id: _, ...updateData } = data;
      await setDoc(doc(db, col, id), updateData, { merge: true });
    } catch (e) {
      console.error('Update error:', e);
      setMessage({ type: 'error', text: 'Error al actualizar.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const [deletingId, setDeletingId] = useState<{col: string, id: string} | null>(null);

  const deleteItem = async (col: string, id: string) => {
    console.log(`Delete requested for ${col}/${id}`);
    if (!id) {
      console.error('No ID provided for deletion');
      return;
    }
    
    // Use state-based confirmation instead of window.confirm
    setDeletingId({ col, id });
  };

  const confirmDeletion = async () => {
    if (!deletingId) return;
    const { col, id } = deletingId;

    try {
      setSaving(true);
      await deleteDoc(doc(db, col, id));
      console.log('Delete successful');
      if (col === 'catalogProducts') {
        setSelectedProducts(prev => prev.filter(pId => pId !== id));
      }
      setMessage({ type: 'success', text: 'Elemento eliminado correctamente.' });
    } catch (e: any) {
      console.error('Delete error details:', e);
      let errorText = 'Error al eliminar.';
      if (e.code === 'permission-denied') {
        errorText = 'No tienes permisos suficientes para eliminar este elemento.';
      }
      setMessage({ type: 'error', text: errorText });
    } finally {
      setSaving(false);
      setDeletingId(null);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const toggleUserRole = async (user: UserProfile) => {
    if (!isAdminUser) {
      setMessage({ type: 'error', text: 'No tienes permisos para cambiar roles.' });
      return;
    }
    if (user.uid === auth.currentUser?.uid) {
      setMessage({ type: 'error', text: 'No puedes quitarte tus propios permisos de administrador.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    if (user.email.toLowerCase() === 'jtrapero2013@gmail.com' && user.role === UserRole.ADMIN) {
      setMessage({ type: 'error', text: 'No se pueden revocar los permisos del administrador principal.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const newRole = user.role === UserRole.ADMIN ? UserRole.AGENT : UserRole.ADMIN;
    
    try {
      setSaving(true);
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        name: user.name || '',
        role: newRole
      }, { merge: true });
      setMessage({ type: 'success', text: `Permisos actualizados a ${newRole === UserRole.ADMIN ? 'Administrador' : 'Agente'}.` });
    } catch (e: any) {
      console.error('Error changing user role:', e);
      setMessage({ type: 'error', text: 'Error al cambiar los permisos del usuario.' });
    } finally {
      setTimeout(() => setMessage(null), 3000);
      setSaving(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserProfile || !editingUserProfile.email) return;

    const emailLower = editingUserProfile.email.toLowerCase().trim();
    const isNew = !editingUserProfile.uid;

    if (isNew) {
      // Check for duplicate emails in local users array
      const isDuplicate = users.some(u => u.email?.toLowerCase() === emailLower);
      if (isDuplicate) {
        setMessage({ type: 'error', text: 'El email indicado ya está registrado en el sistema.' });
        setTimeout(() => setMessage(null), 3500);
        return;
      }

      // Check password input
      if (!newUserPassword || newUserPassword.length < 6) {
        setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
        setTimeout(() => setMessage(null), 3500);
        return;
      }
    } else {
      const isMainAdmin = editingUserProfile.email?.toLowerCase() === 'jtrapero2013@gmail.com';
      if (isMainAdmin && editingUserProfile.role !== UserRole.ADMIN) {
        setMessage({ type: 'error', text: 'No se pueden revocar los permisos del administrador principal.' });
        setTimeout(() => setMessage(null), 3500);
        return;
      }
    }

    let resolvedUid = editingUserProfile.uid || '';

    try {
      setSaving(true);

      // Create Firebase Auth user credentials if it is a new user
      if (isNew) {
        const tempAppName = 'temp-admin-user-create-' + Math.random().toString(36).substring(7);
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
          const userCred = await createUserWithEmailAndPassword(tempAuth, emailLower, newUserPassword);
          resolvedUid = userCred.user.uid;
          await signOut(tempAuth);
        } catch (authError: any) {
          console.error('Error in secondary Auth signup:', authError);
          let errorMsg = 'Error al registrar credenciales de acceso.';
          if (authError.code === 'auth/email-already-in-use') {
            errorMsg = 'El email indicado ya tiene una cuenta activa.';
          } else if (authError.code === 'auth/weak-password') {
            errorMsg = 'La contraseña es demasiado fácil de adivinar (mínimo 6 caracteres).';
          } else if (authError.code === 'auth/invalid-email') {
            errorMsg = 'El formato de correo no es válido.';
          }
          setMessage({ type: 'error', text: errorMsg });
          return;
        }
      }

      const updatedProfile: UserProfile = {
        uid: resolvedUid,
        email: emailLower,
        name: editingUserProfile.name?.trim() || emailLower.split('@')[0],
        role: editingUserProfile.role || UserRole.AGENT
      };

      await setDoc(doc(db, 'users', resolvedUid), updatedProfile);
      
      setMessage({
        type: 'success',
        text: isNew ? 'Usuario registrado con éxito.' : 'Usuario actualizado con éxito.'
      });
      setUserModalOpen(false);
      setEditingUserProfile(null);
      setNewUserPassword('');
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error al registrar el usuario en la base de datos.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4500);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Estás seguro de que quieres borrar ${selectedProducts.length} productos?`)) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      selectedProducts.forEach(id => {
        batch.delete(doc(db, 'catalogProducts', id));
      });
      await batch.commit();
      setSelectedProducts([]);
      setMessage({ type: 'success', text: 'Productos eliminados.' });
    } catch (e: any) {
      console.error('Bulk delete error:', e);
      setMessage({ type: 'error', text: `Error al eliminar productos: ${e.message?.substring(0, 50)}` });
    } finally {
      setTimeout(() => setMessage(null), 5000);
      setSaving(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id!));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    
    // Helper to add sheet if data exists
    const addSheet = (data: any[], sheetName: string) => {
      const cleanData = data.map(({ id, ...rest }) => {
        if (sheetName === 'Matriz_Capilar' && 'baseCost' in rest) {
          const { baseCost, business, ...others } = rest as any;
          return { ...others, cost: baseCost };
        }
        return rest;
      });
      const ws = XLSX.utils.json_to_sheet(cleanData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheet(products, 'Materiales');
    addSheet(brandLogistics, 'Logistica_Marcas');
    addSheet(capillaryRules, 'Matriz_Capilar');
    addSheet(coolingEquipment, 'Equipos_Frio');
    addSheet(maintenanceCosts, 'Mantenimiento');
    addSheet(fixedCosts, 'Gastos_Fijos');

    XLSX.writeFile(wb, `configuracion_operativa_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const templates = {
      'Materiales': [{ name: "Producto X", family: "Cerveza", brand: "Marca", format: "33cl", packaging: "Caja", material: "Vidrio", cost: 0.45, litersPerPallet: 500, palletsPerTruck: 33 }],
      'Logistica_Marcas': [{ family: "Alimentación", brand: "Marca X", origin: "Madrid" }],
      'Matriz_Capilar': [{ family: "Cerveza", brand: "Marca X", format: "33cl", packaging: "Caja", cost: 0.12 }],
      'Equipos_Frio': [{ name: "Nevera Pro", price: 1200, amortizationYears: 5, category: 'nevera' }],
      'Mantenimiento': [{ name: "Mantenimiento anual", amount: 150, isTapRelated: false }],
      'Gastos_Fijos': [{ name: "Alquiler", monthlyAmount: 2000, isTapRelated: false }]
    };

    Object.entries(templates).forEach(([name, data]) => {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    XLSX.writeFile(wb, 'plantilla_configuracion.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let totalCount = 0;
        const batch = writeBatch(db);

        // Helper to process sheet
        const processSheet = (sheetName: string, collectionName: string, fieldMapper: (row: any) => any) => {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;
          const rows = XLSX.utils.sheet_to_json(sheet);
          rows.forEach((row: any) => {
            const docRef = doc(collection(db, collectionName));
            batch.set(docRef, fieldMapper(row));
            totalCount++;
          });
        };

        processSheet('Materiales', 'catalogProducts', row => ({
          name: row.name || 'Sin nombre',
          family: row.family || 'Otros',
          brand: row.brand || 'Genérica',
          format: row.format || 'N/A',
          packaging: row.packaging || 'N/A',
          material: row.material || 'N/A',
          cost: parseFloat(row.cost) || 0,
          litersPerPallet: parseFloat(row.litersPerPallet) || 500,
          palletsPerTruck: parseFloat(row.palletsPerTruck) || 33
        }));

        processSheet('Logistica_Marcas', 'brandLogistics', row => ({
          family: row.family || row.business || 'Negocio',
          brand: row.brand || 'Marca',
          origin: row.origin || 'Origen'
        }));

        processSheet('Matriz_Capilar', 'capillaryRules', row => ({
          business: row.business || 'General',
          family: row.family || 'Cerveza',
          brand: row.brand || 'Marca',
          format: row.format || '33cl',
          packaging: row.packaging || 'Caja',
          baseCost: parseFloat(row.cost || row.baseCost) || 0
        }));

        processSheet('Equipos_Frio', 'coldEquipment', row => ({
          name: row.name || 'Equipo',
          price: parseFloat(row.price) || 0,
          amortizationYears: parseInt(row.amortizationYears) || 5,
          category: (row.category as any) || 'nevera'
        }));

        processSheet('Mantenimiento', 'maintenanceCosts', row => ({
          name: row.name || 'Mantenimiento',
          amount: parseFloat(row.amount) || 0,
          isTapRelated: row.isTapRelated === true || row.isTapRelated === 'true' || row.isTapRelated === 'Yes'
        }));

        processSheet('Gastos_Fijos', 'fixedCosts', row => ({
          name: row.name || 'Gasto fijo',
          monthlyAmount: parseFloat(row.monthlyAmount) || 0,
          isTapRelated: row.isTapRelated === true || row.isTapRelated === 'true' || row.isTapRelated === 'Yes'
        }));

        if (totalCount > 0) {
          await batch.commit();
          setMessage({ type: 'success', text: `Se han importado ${totalCount} registros correctamente.` });
        } else {
          setMessage({ type: 'error', text: 'No se encontraron datos válidos en las hojas esperadas.' });
        }
      } catch (err) {
        console.error('Import error:', err);
        setMessage({ type: 'error', text: 'Error al importar. Verifica el formato del Excel.' });
      } finally {
        setImporting(false);
        setTimeout(() => setMessage(null), 3000);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-[#0f4c3a]" /></div>;

  const tabs: { id: AdminTab, label: string, icon: any }[] = [
    { id: 'config', label: 'General', icon: <Settings2 size={18} /> },
    { id: 'materials', label: 'Materiales', icon: <Package size={18} /> },
    { id: 'transport', label: 'Transporte', icon: <Truck size={18} /> },
    { id: 'cooling', label: 'Equipos Frío', icon: <Wind size={18} /> },
    { id: 'maintenance', label: 'Mantenimiento', icon: <Wrench size={18} /> },
    { id: 'fixed_costs', label: 'Fijos', icon: <Home size={18} /> },
    { id: 'users', label: 'Usuarios / Permisos', icon: <Users size={18} /> },
    { id: 'cases', label: 'Casos por Canales', icon: <FolderOpen size={18} /> },
    { id: 'cora_training', label: 'Entrenar a Cora', icon: <Brain size={18} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-900 mb-2">¿Confirmar borrado?</h3>
              <p className="text-slate-500 text-center mb-8">Esta acción no se puede deshacer. El elemento se eliminará permanentemente de la base de datos.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeletion}
                  disabled={saving}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : 'Borrar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Creation / Editing Modal */}
      <AnimatePresence>
        {userModalOpen && editingUserProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-left"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-[#1c2621]/10"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#1c2621]/8 flex justify-between items-center bg-[#fafdfc]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0f4c3a]/10 rounded-xl flex items-center justify-center text-[#0f4c3a]">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#1c2621] leading-tight">
                      {editingUserProfile.uid ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                    </h3>
                    <p className="text-[10px] text-[#6a7470] font-bold uppercase tracking-wider mt-0.5 leading-none">
                      {editingUserProfile.uid ? 'Modificar datos en el sistema' : 'Registrar un nuevo perfil'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserModalOpen(false);
                    setEditingUserProfile(null);
                  }}
                  className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#6a7470] uppercase tracking-widest block px-1">
                    Nombre del Usuario
                  </label>
                  <input
                    type="text"
                    required
                    value={editingUserProfile.name || ''}
                    onChange={(e) => setEditingUserProfile(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    placeholder="Ej: Laura Martínez"
                    className="w-full bg-[#faf8f5] border border-[#1c2621]/10 rounded-2xl px-4 py-3 font-bold text-sm text-[#1c2621] placeholder:text-slate-350 focus:bg-white focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 transition-all outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#6a7470] uppercase tracking-widest block px-1">
                    Email de Ingreso
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUserProfile.uid} // Disallow changing email of existing users to avoid breaking authentication links
                    value={editingUserProfile.email || ''}
                    onChange={(e) => setEditingUserProfile(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                    placeholder="Ej: laura@empresa.com"
                    className="w-full bg-[#faf8f5] border border-[#1c2621]/10 rounded-xl px-4 py-3 font-bold text-sm text-[#1c2621] placeholder:text-slate-350 focus:bg-white focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 transition-all outline-none disabled:opacity-50"
                  />
                  {editingUserProfile.uid && (
                    <span className="text-[9px] text-[#6a7470] block px-1 font-bold">
                      El email no puede modificarse una vez guardado para preservar el enlace de acceso.
                    </span>
                  )}
                </div>

                {!editingUserProfile.uid && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#6a7470] uppercase tracking-widest block px-1">
                      Contraseña de Acceso * (Mínimo 6 caracteres)
                    </label>
                    <input
                      type="password"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Escribe la contraseña para este usuario..."
                      className="w-full bg-[#faf8f5] border border-[#1c2621]/10 rounded-xl px-4 py-3 font-bold text-sm text-[#1c2621] placeholder:text-slate-350 focus:bg-white focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 transition-all outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#6a7470] uppercase tracking-widest block px-1">
                    Rol de Permisos
                  </label>
                  <select
                    value={editingUserProfile.role || UserRole.AGENT}
                    onChange={(e) => setEditingUserProfile(prev => prev ? ({ ...prev, role: e.target.value as UserRole }) : null)}
                    disabled={editingUserProfile.email?.toLowerCase() === 'jtrapero2013@gmail.com' || editingUserProfile.uid === auth.currentUser?.uid}
                    className="w-full bg-[#faf8f5] border border-[#1c2621]/10 rounded-xl px-4 py-3 font-bold text-sm text-[#1c2621] focus:bg-white focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none cursor-pointer"
                  >
                    <option value={UserRole.AGENT}>Agente comercial (Perfil Estándar)</option>
                    <option value={UserRole.ADMIN}>Administrador total (Edición de Maestros/Configuraciones)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setUserModalOpen(false);
                      setEditingUserProfile(null);
                    }}
                    className="flex-1 py-3 bg-[#faf8f5] hover:bg-[#eae7e1] text-[#1c2621] rounded-xl font-bold border border-[#1c2621]/10 transition-colors text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 bg-[#0f4c3a] text-white rounded-xl font-bold hover:bg-[#0b382b] transition-colors flex items-center justify-center gap-2 text-xs shadow-md shadow-[#0f4c3a]/12"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-[#1c2621]/8 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
        <div>
          <h2 className="text-3xl font-extrabold text-[#1c2621] tracking-tight flex items-center gap-3">
            Atelier de Control
            {isAdminUser && (
              <span className="text-[10px] font-bold bg-[#0f4c3a]/10 text-[#0f4c3a] px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1.5 h-6 self-center">
                <div className="w-1.5 h-1.5 bg-[#0f4c3a] rounded-full animate-pulse" /> SOBERANO (ADMIN)
              </span>
            )}
          </h2>
          <p className="text-[#5a6561] text-xs font-medium tracking-wide mt-1">Gestiona costes operativos, matrices de distribución capilar, amortizaciones y cuentas.</p>
        </div>
        {!isAdminUser && !loading && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-[#bc9c6e] border border-amber-100 rounded-xl text-sm font-bold">
            <ShieldAlert size={18} /> Modo Lectura: Maestro Protegido
          </div>
        )}
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar Nav */}
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarHovered ? 240 : 80 }}
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className="space-y-1 shrink-0 bg-[#f5f1ea]/80 backdrop-blur-md p-3 rounded-[2.5rem] border border-[#1c2621]/8 shadow-[0_4px_20px_rgba(15,76,58,0.01)] sticky top-8 z-20 overflow-hidden"
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#0f4c3a] text-white shadow-[0_8px_20px_rgba(15,76,58,0.18)]' 
                  : 'text-[#6a7470] hover:bg-[#0f4c3a]/5 hover:text-[#0f4c3a]'
              } ${isSidebarHovered ? 'px-4 py-3 rounded-2xl gap-3' : 'p-3 rounded-xl justify-center'}`}
            >
              <div className="shrink-0">{tab.icon}</div>
              <AnimatePresence>
                {isSidebarHovered && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="font-bold text-sm whitespace-nowrap"
                  >
                    {tab.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isSidebarHovered && (
                <ChevronRight size={16} className={`ml-auto transition-opacity ${activeTab === tab.id ? 'opacity-100' : 'opacity-0'}`} />
              )}
            </button>
          ))}
        </motion.aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="bg-white rounded-3xl border border-[#1c2621]/8 shadow-sm overflow-hidden min-h-[500px]"
            >
              {activeTab === 'config' && (
                <div className="p-5 space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[#1c2621]">Parámetros Globales</h3>
                    <button onClick={handleGlobalSave} disabled={saving || !isAdminUser} className="flex items-center gap-2 px-6 py-2.5 bg-[#0f4c3a] text-white font-bold rounded-xl hover:bg-[#0b382b] disabled:opacity-50 transition-all font-bold text-xs tracking-wide uppercase shadow-[0_4px_12px_rgba(15,76,58,0.15)] cursor-pointer">
                      {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Guardar Cambios
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <InputField 
                      label="Coste Camión (€/KM)" 
                      value={config.truckCostPerKm} 
                      onChange={(v) => setConfig(p => ({ ...p, truckCostPerKm: parseFloat(v) }))}
                      icon={<Truck size={16} />}
                    />
                    <InputField 
                      label="Coste Pallet (€/KM)" 
                      value={config.palletCostPerKm} 
                      onChange={(v) => setConfig(p => ({ ...p, palletCostPerKm: parseFloat(v) }))}
                      icon={<Package size={16} />}
                    />
                    <InputField 
                      label="Plus Doble Descarga (€)" 
                      value={config.halfTruckDoubleDropFee} 
                      onChange={(v) => setConfig(p => ({ ...p, halfTruckDoubleDropFee: parseFloat(v) }))}
                      icon={<Truck size={16} />}
                    />
                    <InputField 
                      label="Años Amortización Defecto" 
                      value={config.defaultAmortizationYears} 
                      onChange={(v) => setConfig(p => ({ ...p, defaultAmortizationYears: parseInt(v) }))}
                      icon={<Settings2 size={16} />}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'materials' && (
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 -mx-5 -mt-5 p-4 px-6 border-b border-slate-100 mb-5">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Maestro de Materiales</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{products.length} Registros</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">
                        <FileText size={18} /> Plantilla
                      </button>
                      <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">
                        <Download size={18} /> Exportar
                      </button>
                      <label className={`flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 cursor-pointer transition-all ${!isAdminUser ? 'opacity-50 pointer-events-none' : ''}`}>
                        {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} Importar
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" disabled={importing || !isAdminUser} />
                      </label>
                      <button 
                        onClick={() => addItem('catalogProducts', { name: 'Producto Nuevo', family: 'Cerveza', brand: 'Marca', cost: 0, format: '33cl', packaging: 'Caja', material: 'Vidrio', litersPerPallet: 500, palletsPerTruck: 33 })}
                        disabled={!isAdminUser}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0f4c3a] text-white rounded-xl text-sm font-bold shadow-md hover:bg-[#0b382b] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Plus size={18} /> Añadir
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder="Buscar por nombre, marca o familia..."
                      value={searchTermMaterials}
                      onChange={(e) => setSearchTermMaterials(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#1c2621]/10 rounded-2xl outline-none focus:ring-2 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/30 font-medium shadow-sm transition-all text-[#1c2621]"
                    />
                  </div>

                  {selectedProducts.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-2xl mb-4"
                    >
                      <span className="text-sm font-bold text-rose-700">{selectedProducts.length} productos seleccionados</span>
                      <button 
                        onClick={handleBulkDelete}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Eliminar Selección
                      </button>
                    </motion.div>
                  )}

                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#faf8f5] text-[10px] uppercase font-bold text-[#6a7470]">
                        <tr>
                          <th className="px-3 py-1.5 w-10">
                            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-[#0f4c3a]">
                              {selectedProducts.length === products.length && products.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                          </th>
                          <th className="px-3 py-1.5">Nombre</th>
                          <th className="px-3 py-1.5">Familia/Marca</th>
                          <th className="px-3 py-1.5 text-right">L/P & P/C</th>
                          <th className="px-3 py-1.5 text-right">Litros/Camión</th>
                          <th className="px-3 py-1.5 text-right">Coste (€/Ud)</th>
                          <th className="px-3 py-1.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {products
                          .filter(p => 
                            p.name.toLowerCase().includes(searchTermMaterials.toLowerCase()) ||
                            p.brand.toLowerCase().includes(searchTermMaterials.toLowerCase()) ||
                            p.family.toLowerCase().includes(searchTermMaterials.toLowerCase())
                          )
                          .map(p => (
                          <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${selectedProducts.includes(p.id!) ? 'bg-[#0f4c3a]/5' : ''}`}>
                            <td className="px-3 py-1.5">
                              <button onClick={() => toggleSelect(p.id!)} className="text-slate-300 hover:text-[#0f4c3a]">
                                {selectedProducts.includes(p.id!) ? <CheckSquare size={18} className="text-[#0f4c3a]" /> : <Square size={18} />}
                              </button>
                            </td>
                            <td className="px-3 py-1.5">
                              <input 
                                value={p.name} 
                                onChange={(e) => updateItem('catalogProducts', p.id!, { name: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/40 mb-1"
                              />
                              <div className="flex gap-1">
                                <input 
                                  value={p.format} 
                                  onChange={(e) => updateItem('catalogProducts', p.id!, { format: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] text-slate-400 uppercase outline-none focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/40"
                                  placeholder="Formato"
                                />
                                <input 
                                  value={p.packaging} 
                                  onChange={(e) => updateItem('catalogProducts', p.id!, { packaging: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] text-slate-400 uppercase outline-none focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/40"
                                  placeholder="Envase"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex flex-col gap-1">
                                <input 
                                  value={p.family} 
                                  onChange={(e) => updateItem('catalogProducts', p.id!, { family: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-500 outline-none focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/40"
                                  placeholder="Familia"
                                />
                                <input 
                                  value={p.brand} 
                                  onChange={(e) => updateItem('catalogProducts', p.id!, { brand: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-500 outline-none focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/40"
                                  placeholder="Marca"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    step="any"
                                    value={p.litersPerPallet} 
                                    onChange={(e) => updateItem('catalogProducts', p.id!, { litersPerPallet: parseFloat(e.target.value) })}
                                    className="w-16 text-right text-[10px] bg-white border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/40"
                                  />
                                  <span className="text-[10px] text-slate-400">L/P</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    step="any"
                                    value={p.palletsPerTruck} 
                                    onChange={(e) => updateItem('catalogProducts', p.id!, { palletsPerTruck: parseFloat(e.target.value) })}
                                    className="w-16 text-right text-[10px] bg-white border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/40"
                                  />
                                  <span className="text-[10px] text-slate-400">P/C</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <div className="bg-[#0f4c3a]/5 px-2 py-1 rounded-lg inline-block">
                                <span className="text-xs font-black text-[#0f4c3a]">
                                  {Math.round((p.litersPerPallet || 0) * (p.palletsPerTruck || 0)).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-[#0f4c3a]/65 ml-1 font-bold">L/C</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={p.cost} 
                                  onChange={(e) => updateItem('catalogProducts', p.id!, { cost: parseFloat(e.target.value) })}
                                  className="w-20 text-right font-mono font-bold text-[#0f4c3a] bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/40"
                                />
                                <span className="text-[#0f4c3a] font-bold">€</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <button 
                                onClick={() => deleteItem('catalogProducts', p.id!)} 
                                disabled={!isAdminUser}
                                className="text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-300"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {products.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic">
                              No hay materiales registrados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'transport' && (
                <div className="p-5 space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <SectionHeader 
                      title="Logística por Marca / Origen" 
                      onAdd={() => addItem('brandLogistics', { family: 'Alimentación', brand: 'Marca X', origin: 'Madrid' })}
                      disabled={!isAdminUser}
                    />
                    <div className="flex gap-2">
                      <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer transition-all border border-slate-200 ${!isAdminUser ? 'opacity-50 pointer-events-none' : ''}`}>
                        {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={14} />} Importar
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" disabled={importing || !isAdminUser} />
                      </label>
                      <button 
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-slate-800 transition-all border border-slate-700"
                      >
                        <Download size={14} /> Exportar
                      </button>
                      <button 
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-500 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-all"
                      >
                        <FileText size={14} /> Plantilla
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    {brandLogistics.map(bl => (
                      <div key={bl.id} className="flex flex-col gap-4 p-4 bg-[#faf8f5] rounded-2xl border border-[#1c2621]/10">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#0f4c3a] shadow-sm border border-[#1c2621]/5">
                            <MapPin size={20} />
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Familia</label>
                              <input 
                                value={bl.family} 
                                onChange={(e) => updateItem('brandLogistics', bl.id!, { family: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Marca</label>
                              <input 
                                value={bl.brand} 
                                onChange={(e) => updateItem('brandLogistics', bl.id!, { brand: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35 font-bold text-[#1c2621]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Origen</label>
                              <input 
                                value={bl.origin} 
                                onChange={(e) => updateItem('brandLogistics', bl.id!, { origin: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35"
                              />
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteItem('brandLogistics', bl.id!)} 
                            disabled={!isAdminUser}
                            className="text-slate-300 hover:text-red-500 disabled:opacity-30 self-center"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#0f4c3a]/5 p-6 rounded-3xl border border-[#0f4c3a]/12 flex gap-4">
                    <Info className="text-[#0f4c3a] shrink-0" />
                    <div className="text-sm text-[#0f4c3a] space-y-2">
                      <p className="font-bold">Lógica de Transporte:</p>
                      <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li><strong>Camión:</strong> Coste directo por ruta/distancia (km).</li>
                        <li><strong>1/2 Camión:</strong> Coste camión + {config.halfTruckDoubleDropFee}€ por doble descarga.</li>
                        <li><strong>Pallet:</strong> Coste por pallet por ruta/distancia (km).</li>
                        <li><strong>Capilar:</strong> Coste Camión (primaria) + Coste por unidad (secundaria).</li>
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <SectionHeader 
                        title="Matriz Capilar" 
                        onAdd={() => addItem('capillaryRules', { business: 'Alimentación', family: 'Cerveza', brand: 'Marca X', format: '33cl', packaging: 'Caja', baseCost: 0.12 })}
                        disabled={!isAdminUser}
                      />
                      <div className="flex gap-2">
                        <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer transition-all border border-slate-200 ${!isAdminUser ? 'opacity-50 pointer-events-none' : ''}`}>
                          {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={14} />} Importar
                          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" disabled={importing || !isAdminUser} />
                        </label>
                        <button 
                          onClick={handleExport}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-lg hover:bg-slate-800 transition-all border border-slate-700"
                        >
                          <Download size={14} /> Exportar
                        </button>
                        <button 
                          onClick={handleDownloadTemplate}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-500 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-all"
                        >
                          <FileText size={14} /> Plantilla
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Negocio</th>
                            <th className="px-4 py-3">Referencia (Fam/Mar/For/Env)</th>
                            <th className="px-4 py-3 text-right">Coste (€/Ud)</th>
                            <th className="px-4 py-3 text-right w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {capillaryRules.map(rule => (
                            <tr key={rule.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3">
                                <input 
                                  value={rule.business || ''} 
                                  onChange={(e) => updateItem('capillaryRules', rule.id!, { business: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="grid grid-cols-4 gap-1">
                                  <input 
                                    value={rule.family} 
                                    onChange={(e) => updateItem('capillaryRules', rule.id!, { family: e.target.value })}
                                    className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35 font-bold"
                                    placeholder="Familia"
                                  />
                                  <input 
                                    value={rule.brand} 
                                    onChange={(e) => updateItem('capillaryRules', rule.id!, { brand: e.target.value })}
                                    className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35"
                                    placeholder="Marca"
                                  />
                                  <input 
                                    value={rule.format} 
                                    onChange={(e) => updateItem('capillaryRules', rule.id!, { format: e.target.value })}
                                    className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35"
                                    placeholder="Formato"
                                  />
                                  <input 
                                    value={rule.packaging} 
                                    onChange={(e) => updateItem('capillaryRules', rule.id!, { packaging: e.target.value })}
                                    className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35"
                                    placeholder="Envase"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input 
                                  type="number"
                                  step="any"
                                  value={rule.baseCost} 
                                  onChange={(e) => updateItem('capillaryRules', rule.id!, { baseCost: parseFloat(e.target.value) })}
                                  className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/35 font-mono font-bold text-[#0f4c3a]"
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button 
                                  onClick={() => deleteItem('capillaryRules', rule.id!)} 
                                  disabled={!isAdminUser}
                                  className="text-slate-300 hover:text-red-500 disabled:opacity-30"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'cooling' && (
                <div className="p-5 space-y-5">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Equipos de Frío e Instalaciones</h3>
                      <p className="text-sm text-slate-500">Gestión de activos (Grifos, Neveras, Botelleros) y sus costes de amortización.</p>
                    </div>
                    <button 
                      onClick={() => addItem('coldEquipment', { name: 'Nuevo Equipo', price: 500, amortizationYears: 5, category: 'nevera' })}
                      disabled={!isAdminUser}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#0f4c3a] text-white rounded-xl text-sm font-bold shadow-md hover:bg-[#0b382b] transition-all cursor-pointer"
                    >
                      <Plus size={18} /> Añadir Equipo
                    </button>
                  </div>
                  
                  <div className="grid gap-4">
                    {coolingEquipment.map(eq => (
                      <div key={eq.id} className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-[#0f4c3a]/25 transition-all shadow-sm group">
                        <div className="flex flex-wrap items-center gap-6">
                          <div className="flex-1 min-w-[200px] space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre / Tipo</label>
                            <input 
                              value={eq.name} 
                              onChange={(e) => updateItem('coldEquipment', eq.id!, { name: e.target.value })}
                              className="w-full font-bold text-slate-800 bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/45"
                              placeholder="Ej: Grifo Pro, Nevera XL..."
                            />
                          </div>
                          
                          <div className="w-32 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Coste (€)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={eq.price} 
                              onChange={(e) => updateItem('coldEquipment', eq.id!, { price: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-[#0f4c3a] outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/45"
                            />
                          </div>

                          <div className="w-32 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Amort. (Años)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={eq.amortizationYears} 
                              onChange={(e) => updateItem('coldEquipment', eq.id!, { amortizationYears: parseInt(e.target.value) || 1 })}
                              className="w-full bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/45"
                            />
                          </div>

                          <div className="w-32 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Categoría</label>
                            <select 
                              value={eq.category}
                              onChange={(e) => updateItem('coldEquipment', eq.id!, { category: e.target.value as any })}
                              className="w-full bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/45 cursor-pointer"
                            >
                              <option value="grifo">Grifo</option>
                              <option value="nevera">Nevera</option>
                              <option value="botellero">Botellero</option>
                              <option value="otros">Otros</option>
                            </select>
                          </div>

                          <div className="flex items-end pb-2">
                            <button 
                              onClick={() => deleteItem('coldEquipment', eq.id!)} 
                              disabled={!isAdminUser}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                              title="Eliminar equipo"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {coolingEquipment.length === 0 && (
                      <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm">
                          <Wind size={32} />
                        </div>
                        <p className="text-slate-400 font-medium">No hay equipos de frío configurados.<br/>Usa el botón superior para añadir activos.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'maintenance' && (
                <div className="p-8 space-y-6">
                  <SectionHeader 
                    title="Gastos de Mantenimiento" 
                    onAdd={() => addItem('maintenanceCosts', { name: 'Limpieza Grifos', amount: 45, isTapRelated: true })}
                    disabled={!isAdminUser}
                  />
                  <div className="space-y-4">
                    {maintenanceCosts.map(m => (
                      <div key={m.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-[#0f4c3a]/25 transition-all flex flex-wrap items-center gap-4 group">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Concepto</label>
                          <input 
                            value={m.name} 
                            onChange={(e) => updateItem('maintenanceCosts', m.id!, { name: e.target.value })}
                            className="w-full bg-slate-50 border border-transparent rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/45"
                            placeholder="Nombre del mantenimiento..."
                          />
                        </div>
                        
                        <div className="w-28 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Importe (€)</label>
                          <input 
                            type="number"
                            step="any"
                            value={m.amount} 
                            onChange={(e) => updateItem('maintenanceCosts', m.id!, { amount: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-transparent rounded-lg px-3 py-2 text-sm font-mono font-bold text-[#0f4c3a] outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30"
                          />
                        </div>

                        <div className="flex flex-col items-center gap-1 px-4 border-l border-slate-100">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Es Grifo</label>
                          <button 
                            onClick={() => updateItem('maintenanceCosts', m.id!, { isTapRelated: !m.isTapRelated })}
                            className={`p-1.5 rounded-lg transition-colors border ${
                              m.isTapRelated 
                                ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                : 'bg-slate-50 text-slate-300 border-slate-200'
                            }`}
                            title="Indicar si este coste solo aplica a instalaciones de grifo"
                          >
                            {m.isTapRelated ? <CheckSquare size={20} /> : <Square size={20} />}
                          </button>
                        </div>

                        <div className="flex items-end pb-1">
                          <button 
                            onClick={() => deleteItem('maintenanceCosts', m.id!)} 
                            disabled={!isAdminUser}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {maintenanceCosts.length === 0 && (
                      <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                        No hay costes de mantenimiento registrados.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'fixed_costs' && (
                <div className="p-8 space-y-6">
                  <SectionHeader 
                    title="Gastos Fijos Corporativos" 
                    onAdd={() => addItem('fixedCosts', { name: 'Salarios Logística', monthlyAmount: 3500, isTapRelated: false })}
                    disabled={!isAdminUser}
                  />
                  <div className="space-y-4">
                    {fixedCosts.map(f => (
                      <div key={f.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-[#0f4c3a]/25 transition-all flex flex-wrap items-center gap-4 group">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Concepto</label>
                          <input 
                            value={f.name} 
                            onChange={(e) => updateItem('fixedCosts', f.id!, { name: e.target.value })}
                            className="w-full bg-slate-50 border border-transparent rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30 focus:border-[#0f4c3a]/45"
                            placeholder="Nombre del gasto..."
                          />
                        </div>
                        
                        <div className="w-28 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Importe (€/Mes)</label>
                          <input 
                            type="number"
                            step="any"
                            value={f.monthlyAmount} 
                            onChange={(e) => updateItem('fixedCosts', f.id!, { monthlyAmount: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-transparent rounded-lg px-3 py-2 text-sm font-mono font-bold text-[#0f4c3a] outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30"
                          />
                        </div>

                        <div className="flex flex-col items-center gap-1 px-4 border-l border-slate-100">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Es Grifo</label>
                          <button 
                            onClick={() => updateItem('fixedCosts', f.id!, { isTapRelated: !f.isTapRelated })}
                            className={`p-1.5 rounded-lg transition-colors border ${
                              f.isTapRelated 
                                ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                : 'bg-slate-50 text-slate-300 border-slate-200'
                            }`}
                            title="Indicar si este coste fijo solo aplica a instalaciones de grifo"
                          >
                            {f.isTapRelated ? <CheckSquare size={20} /> : <Square size={20} />}
                          </button>
                        </div>

                        <div className="flex items-end pb-1">
                          <button 
                            onClick={() => deleteItem('fixedCosts', f.id!)} 
                            disabled={!isAdminUser}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {fixedCosts.length === 0 && (
                      <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                        No hay gastos fijos registrados.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="p-8 space-y-6">
                  <div className="flex flex-wrap gap-4 justify-between items-center bg-slate-50 -mx-8 -mt-8 p-8 border-b border-slate-100 mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Control de Usuarios y Permisos</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {users.length} Usuarios Registrados
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          placeholder="Buscar por email o nombre..."
                          value={searchTermUsers}
                          onChange={(e) => setSearchTermUsers(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none text-slate-800 font-medium"
                        />
                      </div>
                      
                      {isAdminUser && (
                        <button
                          onClick={() => {
                            setEditingUserProfile({
                              uid: '',
                              name: '',
                              email: '',
                              role: UserRole.AGENT
                            });
                            setNewUserPassword('');
                            setUserModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#0f4c3a] text-white rounded-xl text-xs font-black shadow-md hover:bg-[#0b382b] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                          <Plus size={14} /> Nuevo Usuario
                        </button>
                      )}
                    </div>
                  </div>

                  {!isAdminUser ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                      <ShieldAlert size={48} className="text-amber-500 animate-pulse" />
                      <h4 className="text-lg font-bold text-slate-800">Acceso Restringido</h4>
                      <p className="text-slate-500 max-w-md">Solo los administradores autorizados pueden visualizar y gestionar los permisos de los usuarios del sistema.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="overflow-hidden border border-slate-100 rounded-3xl bg-white shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                              <th className="px-6 py-4 font-bold">Usuario</th>
                              <th className="px-6 py-4 font-bold">Email</th>
                              <th className="px-6 py-4 font-bold text-center">Rol Actual</th>
                              <th className="px-6 py-4 font-bold text-right">Acciones de Permiso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {users
                              .filter(u => 
                                u.email?.toLowerCase().includes(searchTermUsers.toLowerCase()) || 
                                u.name?.toLowerCase().includes(searchTermUsers.toLowerCase())
                              )
                              .map((u) => {
                                const isSelf = u.uid === auth.currentUser?.uid;
                                const isMainAdmin = u.email?.toLowerCase() === 'jtrapero2013@gmail.com';
                                const isAdminRole = u.role === UserRole.ADMIN;

                                return (
                                  <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm select-none ${
                                          isAdminRole 
                                            ? 'bg-[#0f4c3a]/10 text-[#0f4c3a] font-extrabold border-2 border-[#0f4c3a]/20' 
                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                        }`}>
                                          {u.name ? u.name.substring(0, 2).toUpperCase() : u.email.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                          <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            {u.name || 'Sin Nombre'}
                                            {isSelf && (
                                              <span className="text-[9px] bg-[#0f4c3a]/15 text-[#0f4c3a] px-1.5 py-0.5 rounded-md font-black uppercase">
                                                Tú
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] text-slate-400 font-mono">UID: {u.uid}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                      {u.email}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black leading-none ${
                                        isAdminRole 
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                                      }`}>
                                        {isAdminRole ? 'Administrador' : 'Agente'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => toggleUserRole(u)}
                                          disabled={isSelf || isMainAdmin || saving}
                                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border hover:scale-[1.02] active:scale-[0.98] ${
                                            isAdminRole
                                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
                                              : 'bg-[#0f4c3a]/5 text-[#0f4c3a] hover:bg-[#0f4c3a]/15 border-[#0f4c3a]/20'
                                          } disabled:opacity-30 disabled:pointer-events-none`}
                                          title={isAdminRole ? 'Quitar Permisiones de Administrador' : 'Asignar Permisiones de Administrador'}
                                        >
                                          {isAdminRole ? 'Quitar Admin' : 'Hacer Admin'}
                                        </button>

                                        <button
                                          onClick={() => {
                                            setEditingUserProfile(u);
                                            setUserModalOpen(true);
                                          }}
                                          disabled={isMainAdmin && !isSelf}
                                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#0f4c3a] transition-colors disabled:opacity-30"
                                          title="Editar Nombre u Otros"
                                        >
                                          <Settings2 size={15} />
                                        </button>

                                        <button
                                          onClick={() => deleteItem('users', u.uid)}
                                          disabled={isSelf || isMainAdmin || saving}
                                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-all disabled:opacity-30"
                                          title="Eliminar de la Base de Datos"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            {users.length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 text-sm">
                                  No hay usuarios registrados que coincidan con la búsqueda.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-4 bg-[#0f4c3a]/5 border border-[#0f4c3a]/10 rounded-3xl flex gap-3 text-xs text-[#0f4c3a] font-medium leading-relaxed">
                        <Info size={16} className="shrink-0 mt-0.5 text-[#0f4c3a]" />
                        <div>
                          <span className="font-bold">Información de Seguridad:</span> Los roles determinan qué usuarios pueden actualizar maestros de datos, modificar configuraciones operativas o editar permisos. El creador principal (<span className="font-mono text-[#0f4c3a]">jtrapero2013@gmail.com</span>) mantiene permisos de administración de forma permanente para garantizar el acceso al sistema. No puedes quitarte tu propio rol para evitar orfandad administrativa.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'cases' && (
                <div className="p-8 space-y-6 animate-in fade-in">
                  <div className="flex flex-wrap gap-4 justify-between items-center bg-slate-50 -mx-8 -mt-8 p-8 border-b border-slate-100 mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Casos Ordenados por Canales</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {allCases.length} Casos de Negocio en Total
                      </p>
                    </div>
                    {selectedFolder && (
                      <button
                        onClick={() => {
                          if (selectedCreator) {
                            setSelectedCreator(null);
                          } else {
                            setSelectedFolder(null);
                          }
                          setSearchTermCases('');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all border border-slate-300 cursor-pointer"
                      >
                        <ArrowLeft size={14} /> {selectedCreator ? 'Volver a Creadores' : 'Volver a Carpetas'}
                      </button>
                    )}
                  </div>

                  {!selectedFolder ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries({
                        'ALIMENTACION': { label: 'Alimentación', color: 'bg-amber-500 border-amber-200 text-amber-700 bg-amber-50/50', iconBg: 'bg-amber-100 text-amber-600' },
                        'GRANDES CUENTAS': { label: 'Grandes Cuentas', color: 'bg-indigo-500 border-indigo-200 text-indigo-700 bg-indigo-50/50', iconBg: 'bg-indigo-100 text-indigo-600' },
                        'CONVENIENCIA': { label: 'Conveniencia', color: 'bg-emerald-500 border-emerald-200 text-emerald-700 bg-emerald-50/50', iconBg: 'bg-emerald-100 text-emerald-600' },
                        'IMPORTADAS': { label: 'Importadas', color: 'bg-sky-500 border-sky-200 text-sky-700 bg-sky-50/50', iconBg: 'bg-sky-100 text-sky-600' },
                        'OTROS': { label: 'Sin Canal / General', color: 'bg-slate-500 border-slate-200 text-slate-700 bg-slate-50/50', iconBg: 'bg-slate-100 text-slate-600' }
                      }).map(([key, folder]) => {
                        const casesInFolder = allCases.filter(c => {
                          if (key === 'OTROS') return !c.channel || !['ALIMENTACION', 'GRANDES CUENTAS', 'CONVENIENCIA', 'IMPORTADAS'].includes(c.channel);
                          return c.channel === key;
                        });

                        const pendingCount = casesInFolder.filter(c => !c.status || c.status === 'pending').length;

                        return (
                          <motion.div
                            key={key}
                            whileHover={{ scale: 1.02, y: -2 }}
                            onClick={() => setSelectedFolder(key)}
                            className="group border border-slate-200 rounded-3xl p-6 transition-all cursor-pointer bg-white hover:border-[#0f4c3a]/25 hover:shadow-md flex flex-col justify-between min-h-[170px]"
                          >
                            <div className="flex justify-between items-start">
                              <div className={`p-4 rounded-2xl ${folder.iconBg} transform group-hover:scale-110 transition-transform`}>
                                <FolderOpen size={28} />
                              </div>
                              <span className="text-2xl font-black text-slate-300 group-hover:text-slate-400 font-mono">
                                {casesInFolder.length}
                              </span>
                            </div>

                            <div className="mt-4">
                              <h4 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-[#0f4c3a] transition-colors">
                                {folder.label}
                              </h4>
                              <div className="flex gap-2 items-center mt-2">
                                <span className="text-xs text-slate-500 font-medium">
                                  {casesInFolder.length} {casesInFolder.length === 1 ? 'caso' : 'casos'}
                                </span>
                                {pendingCount > 0 && (
                                  <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                                    {pendingCount} Pendiente{pendingCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    (() => {
                      const casesInFolder = allCases.filter(c => {
                        if (selectedFolder === 'OTROS') {
                          return !c.channel || !['ALIMENTACION', 'GRANDES CUENTAS', 'CONVENIENCIA', 'IMPORTADAS'].includes(c.channel);
                        }
                        return c.channel === selectedFolder;
                      });

                      const creatorGroups = casesInFolder.reduce((acc, c) => {
                        const creatorName = users.find(u => u.uid === c.userId)?.name || c.userName || c.importadasData?.creadorNombre || users.find(u => u.uid === c.userId)?.email || 'Agente Desconocido';
                        if (!acc[creatorName]) {
                          acc[creatorName] = [];
                        }
                        acc[creatorName].push(c);
                        return acc;
                      }, {} as Record<string, BusinessCase[]>);

                      return !selectedCreator ? (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4 justify-between bg-[#faf8f5] p-5 rounded-3xl border border-[#1c2621]/8">
                            <div className="flex items-center gap-3">
                              <div className="p-3 rounded-2xl bg-[#0f4c3a]/15 text-[#0f4c3a] font-extrabold flex items-center justify-center">
                                <FolderOpen size={22} className="fill-[#0f4c3a]/15" />
                              </div>
                              <div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Carpeta Seleccionada</span>
                                <h4 className="text-lg font-extrabold text-slate-800">
                                  Canal: {selectedFolder === 'ALIMENTACION' ? 'Alimentación' :
                                          selectedFolder === 'GRANDES CUENTAS' ? 'Grandes Cuentas' :
                                          selectedFolder === 'CONVENIENCIA' ? 'Conveniencia' :
                                          selectedFolder === 'IMPORTADAS' ? 'Importadas' : 'Sin Canal / General'}
                                </h4>
                              </div>
                            </div>
                            <span className="text-xs bg-[#0f4c3a]/5 text-[#0f4c3a] border border-[#0f4c3a]/10 px-3 py-1.5 rounded-xl font-bold font-mono tracking-wider">
                              {casesInFolder.length} casos en total
                            </span>
                          </div>

                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(creatorGroups).map(([creatorName, casesList]) => {
                              const pendingInGroup = casesList.filter(c => !c.status || c.status === 'pending').length;

                              return (
                                <motion.div
                                  key={creatorName}
                                  whileHover={{ scale: 1.02, y: -2 }}
                                  onClick={() => setSelectedCreator(creatorName)}
                                  className="group border border-slate-200 rounded-3xl p-6 transition-all cursor-pointer bg-white hover:border-[#0f4c3a]/25 hover:shadow-md flex flex-col justify-between min-h-[160px]"
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="p-4 rounded-2xl bg-emerald-50 text-[#0f4c3a] transform group-hover:scale-110 transition-transform">
                                      <Users size={24} />
                                    </div>
                                    <span className="text-2xl font-black text-slate-300 group-hover:text-slate-450 font-mono">
                                      {casesList.length}
                                    </span>
                                  </div>

                                  <div className="mt-4">
                                    <h4 className="text-md font-black text-slate-850 tracking-tight group-hover:text-[#0f4c3a] transition-colors leading-snug break-all">
                                      {creatorName}
                                    </h4>
                                    <div className="flex gap-2 items-center mt-2">
                                      <span className="text-xs text-slate-500 font-semibold">
                                        {casesList.length} {casesList.length === 1 ? 'caso' : 'casos'}
                                      </span>
                                      {pendingInGroup > 0 && (
                                        <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                                          {pendingInGroup} Pnd.
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6 animate-in fade-in duration-205">
                          <div className="flex flex-wrap gap-4 justify-between items-center bg-[#faf8f5] p-5 rounded-3xl border border-[#1c2621]/8">
                            <div className="flex items-center gap-3">
                              <div className="p-3 rounded-2xl bg-emerald-50 text-[#0f4c3a] font-extrabold flex items-center justify-center">
                                <Users size={22} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 select-none">
                                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-[#0f4c3a] transition-colors" onClick={() => setSelectedCreator(null)}>
                                    {selectedFolder === 'ALIMENTACION' ? 'Alimentación' :
                                     selectedFolder === 'GRANDES CUENTAS' ? 'Grandes Cuentas' :
                                     selectedFolder === 'CONVENIENCIA' ? 'Conveniencia' :
                                     selectedFolder === 'IMPORTADAS' ? 'Importadas' : 'Sin Canal / General'}
                                  </span>
                                  <span className="text-xs text-slate-400">/</span>
                                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Creador</span>
                                </div>
                                <h4 className="text-lg font-extrabold text-slate-800">
                                  {selectedCreator}
                                </h4>
                              </div>
                            </div>

                            <div className="relative max-w-xs w-full">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input
                                type="text"
                                placeholder="Buscar caso..."
                                value={searchTermCases}
                                onChange={(e) => setSearchTermCases(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none text-slate-805 font-medium shadow-sm transition-all"
                              />
                            </div>
                          </div>

                          <div className="overflow-hidden border border-slate-100 rounded-3xl bg-white shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                  <th className="px-6 py-4 font-bold">Título del Caso</th>
                                  <th className="px-6 py-4 font-bold">Fecha Creación</th>
                                  <th className="px-6 py-4 font-bold text-center">Estado de Rentabilidad</th>
                                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {casesInFolder
                                  .filter(c => {
                                    const creatorName = users.find(u => u.uid === c.userId)?.name || c.userName || c.importadasData?.creadorNombre || users.find(u => u.uid === c.userId)?.email || 'Agente Desconocido';
                                    if (creatorName !== selectedCreator) return false;

                                    if (!searchTermCases) return true;
                                    const term = searchTermCases.toLowerCase();
                                    return c.title?.toLowerCase().includes(term);
                                  })
                                  .map((c) => {
                                    const cStatus = c.status || 'pending';

                                    return (
                                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-[#0f4c3a]/5 flex items-center justify-center text-[#0f4c3a] shrink-0">
                                              <FileText size={18} />
                                            </div>
                                            <div>
                                              <div className="font-extrabold text-slate-850 text-sm leading-tight">{c.title}</div>
                                              <div className="text-[10px] text-slate-400 capitalize mt-0.5">{c.logisticsType || 'Capilar'} • {c.years} años</div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400 select-none font-mono">
                                          {new Date(c.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black leading-none ${
                                            cStatus === 'positive' 
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                              : cStatus === 'negative'
                                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                                          }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                              cStatus === 'positive' ? 'bg-emerald-500' : cStatus === 'negative' ? 'bg-rose-500' : 'bg-amber-500'
                                            }`} />
                                            {cStatus === 'positive' ? 'Rentabilidad Positiva' : cStatus === 'negative' ? 'Rentabilidad Negativa' : 'Pendiente de Revisión'}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                          <button
                                            onClick={() => onViewCase && onViewCase(c.id!)}
                                            className="inline-flex items-center gap-1 px-4 py-2 bg-[#0f4c3a]/5 hover:bg-[#0f4c3a]/12 hover:text-[#0b382b] font-medium font-bold text-xs text-[#0f4c3a] rounded-xl transition-all border border-[#0f4c3a]/15 shadow-sm cursor-pointer"
                                          >
                                            <Eye size={14} /> Inspeccionar
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {activeTab === 'cora_training' && (
                <div className="p-8 space-y-6 animate-in fade-in-50 duration-300">
                  <div className="bg-slate-50 -mx-8 -mt-8 p-8 border-b border-slate-100 mb-8 flex justify-between items-center sm:flex-row flex-col gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Brain className="text-[#0f4c3a]" size={24} /> Centro de Aprendizaje de Cora
                      </h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Saca a Cora del piloto automático y configúrala como una secretaria con 10 años de experiencia
                      </p>
                    </div>
                    {isAdminUser && (
                      <button 
                        onClick={() => addItem('coraTraining', { phrase: 'escribe frase aquí...', response: 'escribe la respuesta personalizada de Cora aquí...' })}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#0f4c3a] hover:bg-[#0b382b] text-white rounded-xl text-sm font-bold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      >
                        <Plus size={18} /> Añadir regla de aprendizaje
                      </button>
                    )}
                  </div>

                  {/* Informational Guidance */}
                  <div className="p-5 bg-[#faf8f5] border border-amber-200/50 rounded-2xl flex gap-4 text-xs text-slate-600">
                    <Sparkles className="text-amber-500 shrink-0 mt-0.5" size={20} />
                    <div className="space-y-1">
                      <p className="font-extrabold text-[#1c2621]">¿Cómo funciona el entrenamiento de Cora?</p>
                      <p>
                        Introduce palabras clave o frases enteras que el usuario suele decir. Cuando Cora detecte esas palabras en la transcripción de su canal de voz o chat, <strong>interrumpirá el diálogo robótico estándar</strong> para responder usando tu texto personalizado.
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Ejemplo: Si enseñas la frase <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">quién eres</code>, Cora responderá: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">¡Hombre jefe! ¿Quién voy a ser? Soy Cora, tu fiel asistente de los últimos diez años. ¿Qué tramamos hoy?</code>
                      </p>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder="Buscar por regla de voz, palabra clave o respuesta de Cora..."
                      value={searchTermCora}
                      onChange={(e) => setSearchTermCora(e.target.value)}
                      className="w-full bg-[#faf8f5] border border-[#1c2621]/15 rounded-2xl pl-12 pr-4 py-3 font-semibold text-sm placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#0f4c3a]/20 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-4">
                    {coraTraining
                      .filter(rule => {
                        const term = searchTermCora.toLowerCase();
                        return (rule.phrase?.toLowerCase() || '').includes(term) || (rule.response?.toLowerCase() || '').includes(term);
                      })
                      .map(rule => (
                        <div key={rule.id} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:border-[#0f4c3a]/25 hover:shadow-md transition-all flex flex-col md:flex-row gap-4">
                          
                          <div className="flex-1 space-y-1.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">SI EL USUARIO DICE (Frase / Palabra clave):</span>
                            <input 
                              value={rule.phrase} 
                              disabled={!isAdminUser}
                              onChange={(e) => updateItem('coraTraining', rule.id!, { phrase: e.target.value })}
                              className="w-full bg-slate-50 border border-transparent rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30 transition-all disabled:opacity-60"
                              placeholder="Ej: cómo te llamas / qué tal estás..."
                            />
                          </div>

                          <div className="flex-[2] space-y-1.5">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 font-black">
                              <Sparkles size={12} className="animate-pulse" /> CORA RESPONDERÁ CON ESTA ACTITUD / VOZ:
                            </span>
                            <textarea 
                              value={rule.response} 
                              disabled={!isAdminUser}
                              onChange={(e) => updateItem('coraTraining', rule.id!, { response: e.target.value })}
                              className="w-full bg-[#faf8f5] border border-transparent rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-[#0f4c3a]/30 transition-all disabled:opacity-60 min-h-[80px]"
                              placeholder="Escribe el diálogo divertido, familiar o profesional que Cora pronunciará..."
                            />
                          </div>

                          {isAdminUser && (
                            <div className="flex items-center justify-end md:self-center border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                              <button 
                                onClick={() => deleteItem('coraTraining', rule.id!)} 
                                className="p-3 text-slate-350 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                title="Eliminar regla de entrenamiento"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                    {coraTraining.length === 0 && (
                      <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                        <Brain className="mx-auto text-slate-300" size={36} />
                        <p className="font-bold text-sm text-slate-400">No hay reglas de IA personalizadas para Cora.</p>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Añade una regla arriba para enseñarle vocabulario, respuestas espontáneas sobre vuestra relación de trabajo o comentarios específicos sobre costes.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-8 right-8 p-4 rounded-xl font-medium text-sm border shadow-xl z-50 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
          }`}
        >
          {message.text}
        </motion.div>
      )}
    </div>
  );
}

function SectionHeader({ title, count, onAdd, disabled }: { title: string, count?: number, onAdd: () => void, disabled?: boolean }) {
  return (
    <div className="flex justify-between items-center bg-slate-50 -mx-8 -mt-8 p-8 border-b border-slate-100 mb-8">
      <div>
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        {count !== undefined && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{count} Registros</p>}
      </div>
      <button 
        onClick={onAdd}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-[#0f4c3a] hover:bg-[#0b382b] text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
      >
        <Plus size={18} /> Añadir Nuevo
      </button>
    </div>
  );
}

function InputField({ label, value, onChange, icon }: { label: string, value: any, onChange: (v: string) => void, icon?: any }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input 
          type="number"
          step="any"
          value={isNaN(Number(value)) ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full ${icon ? 'pl-10' : 'px-4'} pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 transition-all font-mono font-bold text-slate-800`}
        />
      </div>
    </div>
  );
}

