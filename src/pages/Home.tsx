import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Star, Users, Brain, Mic, BarChart3, ShieldCheck, Building2, Landmark, ChevronDown } from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export default function Home() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleSectorSelect = (sector: 'Government' | 'Private') => {
    navigate('/setup', { state: { sector } });
  };

  const features = [
    {
      title: 'AI Generated Questions',
      description: 'Get dynamic questions tailored to the job role and your experience level.',
      icon: Brain,
      color: 'blue'
    },
    {
      title: 'Voice Interview',
      description: 'Practice speaking with real-time speech recognition and transcription.',
      icon: Mic,
      color: 'purple'
    },
    {
      title: 'AI Evaluation',
      description: 'Instant feedback on communication, technical accuracy, and confidence.',
      icon: ShieldCheck,
      color: 'green'
    },
    {
      title: 'Performance Analytics',
      description: 'Track your progress with detailed reports and comparative data.',
      icon: BarChart3,
      color: 'orange'
    }
  ];

  return (
    <div className="bg-white dark:bg-slate-950 transition-colors overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-6 max-w-7xl mx-auto">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="text-center space-y-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full border border-blue-100 dark:border-blue-800"
          >
            <Star className="w-4 h-4 text-blue-600 fill-blue-600" />
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Trusted by 10,000+ candidates</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white"
          >
            Practice Smarter.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              Crack Interviews with AI.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto text-xl text-slate-600 dark:text-slate-400"
          >
            Prepare for your dream job using AI-powered mock interviews, personalized feedback, resume-based questions, and real-time performance analytics.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 pt-4"
          >
            <Link
              to="/setup"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 hover:scale-105 transition-transform flex items-center group"
            >
              Start Interview Now
              <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="px-8 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl font-bold text-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center outline-none">
                  <Building2 className="w-5 h-5 mr-2" />
                  Sector
                  <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content 
                  className="min-w-[200px] bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200 z-50"
                  sideOffset={8}
                >
                  <DropdownMenu.Item 
                    className="flex items-center px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 outline-none cursor-pointer transition-colors"
                    onClick={() => handleSectorSelect('Government')}
                  >
                    <Landmark className="w-4 h-4 mr-3" />
                    Government Sector
                  </DropdownMenu.Item>
                  <DropdownMenu.Item 
                    className="flex items-center px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 outline-none cursor-pointer transition-colors"
                    onClick={() => handleSectorSelect('Private')}
                  >
                    <Building2 className="w-4 h-4 mr-3" />
                    Private Sector
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-20 relative max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 group"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent z-10" />
          <img
            src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=80&w=2070"
            alt="AI Interview Dashboard"
            className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute bottom-12 left-12 right-12 z-20">
            <div className="flex items-center space-x-6">
               <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                  <p className="text-white/60 text-sm font-medium mb-1">Average Score</p>
                  <p className="text-white text-3xl font-bold">87%</p>
               </div>
               <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                  <p className="text-white/60 text-sm font-medium mb-1">Confidence</p>
                  <p className="text-white text-3xl font-bold">Strong</p>
               </div>
               <div className="hidden sm:block bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                  <p className="text-white/60 text-sm font-medium mb-1">Sessions</p>
                  <p className="text-white text-3xl font-bold">24</p>
               </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto border-t border-slate-100 dark:border-slate-900">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white">Why Choose Intervyou AI?</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
            Our platform combines cutting-edge AI with expert interview techniques to give you the most realistic practice environment.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors group"
            >
              <div className={`w-14 h-14 rounded-2xl bg-${feature.color}-50 dark:bg-${feature.color}-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`w-7 h-7 text-${feature.color}-600 dark:text-${feature.color}-400`} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">I</span>
            </div>
            <span className="text-xl font-bold dark:text-white">Intervyou</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            © 2026 Intervyou AI. All rights reserved. Built with passion for your success.
          </p>
          <div className="flex space-x-6">
            <a href="#" className="text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors">Terms</a>
            <a href="#" className="text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
