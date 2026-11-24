import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Star,
  Zap,
  Building2,
  Calendar,
  Globe,
  Settings,
  ChevronRight
} from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { JobNotification } from '../types';

export default function AdminNotifications() {
  const { notifications, addNotification, updateNotification, deleteNotification } = useAppState();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<JobNotification>>({
    sector: 'Private',
    status: 'New',
    isFeatured: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const notification: JobNotification = {
      id: editingId || Math.random().toString(36).substr(2, 9),
      company: formData.company || '',
      title: formData.title || '',
      sector: formData.sector as 'Private' | 'Government',
      category: formData.category || '',
      location: formData.location || '',
      qualification: formData.qualification || '',
      experience: formData.experience || '',
      salary: formData.salary,
      lastDate: formData.lastDate || '',
      releaseDate: formData.releaseDate || new Date().toISOString().split('T')[0],
      applyLink: formData.applyLink || '',
      officialWebsite: formData.officialWebsite || '',
      status: formData.status as 'New' | 'Closing Soon' | 'Closed',
      isFeatured: formData.isFeatured,
      description: formData.description
    };

    if (editingId) {
      updateNotification(notification);
      setEditingId(null);
    } else {
      addNotification(notification);
      setIsAdding(false);
    }
    setFormData({ sector: 'Private', status: 'New', isFeatured: false });
  };

  const handleEdit = (job: JobNotification) => {
    setFormData(job);
    setEditingId(job.id);
    setIsAdding(true);
  };

  return (
    <div className="space-y-12 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center space-x-6">
          <div className="w-16 h-16 bg-slate-900 rounded-[24px] flex items-center justify-center shadow-xl">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Manage Notifications</h1>
            <p className="text-slate-500 font-bold">Add, edit or remove job listings</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setFormData({ sector: 'Private', status: 'New', isFeatured: false });
          }}
          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 flex items-center space-x-2 hover:scale-105 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Post New Job</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor Modal/Panel */}
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="lg:col-span-5 space-y-8 sticky top-24 h-fit"
            >
              <div className="p-10 rounded-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                  {editingId ? <Edit3 className="w-6 h-6 text-blue-600" /> : <Plus className="w-6 h-6 text-blue-600" />}
                  <span>{editingId ? 'Update Notification' : 'Post New Opportunity'}</span>
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sector</label>
                      <select 
                        value={formData.sector}
                        onChange={(e) => setFormData({...formData, sector: e.target.value as any})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Private">Private</option>
                        <option value="Government">Government</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="New">New</option>
                        <option value="Closing Soon">Closing Soon</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Company / Organization</label>
                    <input 
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Google, UPSC"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Job Title / Exam Name</label>
                    <input 
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Civil Services, Software Engineer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                      <input 
                        type="text"
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Software, Banking"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Location</label>
                      <input 
                        type="text"
                        required
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Hyderabad, Remote"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Experience</label>
                      <input 
                        type="text"
                        required
                        value={formData.experience}
                        onChange={(e) => setFormData({...formData, experience: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Freshers, 2-4 Years"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Salary (Optional)</label>
                      <input 
                        type="text"
                        value={formData.salary}
                        onChange={(e) => setFormData({...formData, salary: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 15-20 LPA"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Qualification</label>
                    <input 
                      type="text"
                      required
                      value={formData.qualification}
                      onChange={(e) => setFormData({...formData, qualification: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. B.Tech, Any Graduate"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Last Date</label>
                      <input 
                        type="date"
                        required
                        value={formData.lastDate}
                        onChange={(e) => setFormData({...formData, lastDate: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Featured</label>
                      <div 
                        onClick={() => setFormData({...formData, isFeatured: !formData.isFeatured})}
                        className={`w-full p-3 rounded-xl font-bold flex items-center justify-center space-x-2 cursor-pointer transition-all ${formData.isFeatured ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        <Star className={`w-4 h-4 ${formData.isFeatured ? 'fill-current' : ''}`} />
                        <span>{formData.isFeatured ? 'Featured' : 'Regular'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Apply Link</label>
                    <input 
                      type="url"
                      required
                      value={formData.applyLink}
                      onChange={(e) => setFormData({...formData, applyLink: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20"
                    >
                      {editingId ? 'Update Listing' : 'Post Notification'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Listings Panel */}
        <div className={`${isAdding ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
          <div className="p-8 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-black flex items-center gap-3">
                 <Building2 className="w-6 h-6 text-blue-600" />
                 <span>Active Listings</span>
               </h3>
               <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                 {notifications.length} Total Jobs
               </div>
             </div>

             <div className="space-y-4">
               {notifications.map((job) => (
                 <div 
                   key={job.id}
                   className="p-6 rounded-[32px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:bg-white dark:hover:bg-slate-800 transition-all"
                 >
                   <div className="flex items-center space-x-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${job.sector === 'Private' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                        {job.sector === 'Private' ? <Zap className="w-6 h-6" /> : <Star className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <h4 className="font-black text-slate-900 dark:text-white">{job.title}</h4>
                           {job.isFeatured && <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />}
                        </div>
                        <p className="text-xs font-bold text-slate-500">{job.company} • {job.location}</p>
                      </div>
                   </div>
                   
                   <div className="flex items-center space-x-3">
                     <button 
                       onClick={() => handleEdit(job)}
                       className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm"
                     >
                       <Edit3 className="w-4 h-4" />
                     </button>
                     <button 
                       onClick={() => deleteNotification(job.id)}
                       className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-red-600 rounded-xl transition-all shadow-sm"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                     <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />
                     <button className="p-3 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                       <ChevronRight className="w-4 h-4" />
                     </button>
                   </div>
                 </div>
               ))}

               {notifications.length === 0 && (
                 <div className="py-20 text-center space-y-4">
                   <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                     <AlertCircle className="w-10 h-10 text-slate-300" />
                   </div>
                   <p className="text-slate-500 font-bold">No active listings. Post something new!</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
