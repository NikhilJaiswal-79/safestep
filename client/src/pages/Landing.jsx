import { useNavigate } from 'react-router-dom';
import { 
  Shield, Zap, Users, Map as MapIcon, 
  ChevronRight, Star, Globe, Smartphone, 
  Heart, CheckCircle 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const features = [
    {
      icon: <Zap className="text-yellow-400" />,
      title: "Instant SOS",
      desc: "One tap or simple shake to alert trusted contacts and nearby volunteers instantly."
    },
    {
      icon: <MapIcon className="text-cyan-400" />,
      title: "Safety Heatmaps",
      desc: "Visualize crowdsourced incident reports to avoid high-risk zones in real-time."
    },
    {
      icon: <Users className="text-purple-400" />,
      title: "Community Watch",
      desc: "A network of verified volunteers ready to assist when you need it most."
    },
    {
      icon: <Smartphone className="text-pink-400" />,
      title: "Fake Call",
      desc: "Discreetly exit uncomfortable situations with a realistic simulated incoming call."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] text-white overflow-hidden font-outfitSelection">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-6 max-w-7xl mx-auto border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(230,57,70,0.4)]">
            <Shield size={24} className="text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter">SafeStep</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-gray-400">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#stats" className="hover:text-white transition">Impact</a>
          <button onClick={() => navigate('/blog')} className="hover:text-white transition">Safety Blog</button>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'hi' : 'en')}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition flex items-center gap-2 text-xs font-bold"
          >
            <Globe size={16} />
            {i18n.language === 'en' ? 'हिंदी' : 'English'}
          </button>
          <button 
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-white text-secondary font-black rounded-xl hover:bg-gray-200 transition text-sm active:scale-95"
          >
            Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 max-w-7xl mx-auto">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] -z-10 -translate-x-1/2"></div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 animate-bounce">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Hackathon Winner 2024</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter mb-8 italic">
              YOU ARE NEVER <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-pink-500">ALONE.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed font-medium">
              The world's first community-powered women's safety platform using AI anomaly detection and a network of 10,000+ verified volunteers.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button 
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-[0_8px_30px_rgba(230,57,70,0.4)] hover:bg-red-600 transition flex items-center justify-center gap-2 text-lg active:scale-95"
              >
                Protect Me Now
                <ChevronRight size={20} />
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 transition font-bold rounded-2xl flex items-center justify-center gap-2">
                Watch Demo
              </button>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-primary rounded-[40px] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative rounded-[40px] overflow-hidden border border-white/10 bg-[#1e293b]/50 backdrop-blur-xl p-4">
              <img 
                src="https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=2024&auto=format&fit=crop" // Fallback placeholder, will replace with generated or better asset
                srcSet="/safestep_landing_hero_1775125204505.png"
                alt="SafeStep Hero" 
                className="rounded-[32px] w-full shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-primary mb-4">Core Technology</h2>
            <h3 className="text-4xl md:text-5xl font-black">Built for the Real World</h3>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f, i) => (
              <div key={i} className="p-8 rounded-[32px] bg-white/5 border border-white/10 hover:border-white/20 transition group">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition duration-500">
                  {f.icon}
                </div>
                <h4 className="text-xl font-black mb-3">{f.title}</h4>
                <p className="text-gray-400 text-sm leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 mb-2">12k+</div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Active Users</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-px h-16 bg-white/10"></div>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 mb-2">150s</div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Avg Response Time</p>
            <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-16 bg-white/10"></div>
          </div>
          <div>
            <div className="text-6xl font-black text-cyan-400 mb-2">99%</div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Safety Confidence</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5 text-center">
        <p className="text-gray-500 text-sm font-medium flex items-center justify-center gap-2">
          Made with <Heart size={14} className="text-primary fill-primary" /> for the community. © 2024 SafeStep.
        </p>
      </footer>
    </div>
  );
}
