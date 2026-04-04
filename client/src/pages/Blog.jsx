import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock, Heart, Share2, ChevronRight, Bookmark } from 'lucide-react';

const ARTICLES = [
  {
    id: 1,
    title: "Self-Defense 101: Simple Moves Every Woman Should Know",
    excerpt: "Physical safety starts with awareness and a few key techniques. Learn how to protect yourself in everyday situations.",
    author: "SafeStep Team",
    date: "March 24, 2024",
    readTime: "5 min",
    category: "Safety Tips",
    image: "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=2070&auto=format&fit=crop",
    content: `
      Self-defense isn't just about fighting back; it's about being prepared and aware of your surroundings. 
      Here are three fundamental tips to keep in mind:
      1. Trust your intuition: If a situation feels wrong, it probably is. Leave immediately.
      2. Maintain distance: Keep at least two arm-lengths between you and a stranger.
      3. Use your voice: A loud "No!" or "Step Back!" can deter an attacker and attract attention.
      Physical techniques should be a last resort, but knowing how to strike effectively (palm heel strike, knee to groin) can create the window you need to escape.
    `
  },
  {
    id: 2,
    title: "The Power of Community: How SafeStep Volunteers Save Lives",
    excerpt: "SafeStep isn't just an app; it's a network of thousands of verified individuals ready to help at a moment's notice.",
    author: "Community Manager",
    date: "March 20, 2024",
    readTime: "4 min",
    category: "Community",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=2064&auto=format&fit=crop",
    content: `
      Our volunteer network is the heart of SafeStep. When an SOS is triggered, local volunteers receive a precise 
      location and can reach the victim often before official emergency services. 
      Being a volunteer means more than just having an app; it means being a vigilant neighbor. 
      Join the movement today by enabling Volunteer Mode in your profile settings.
    `
  },
  {
    id: 3,
    title: "Traveling Solo? Here's Your Essential Safety Checklist",
    excerpt: "Exploring the world alone is empowering, but it requires extra vigilance. Make sure you're prepared.",
    author: "Sarah J., Solo Traveler",
    date: "March 15, 2024",
    readTime: "7 min",
    category: "Travel",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=2070&auto=format&fit=crop",
    content: `
      Solo travel is one of the most rewarding experiences a woman can have. To ensure your journey is safe:
      1. Research your destination: Know the safe and unsafe neighborhoods.
      2. Share your itinerary: Always keep someone at home informed of your whereabouts.
      3. Use SafeStep's Live Location: Share your real-time position with contacts.
      4. Stay in public places: Avoid walking alone in secluded areas at night.
    `
  }
];

export default function Blog() {
  const navigate = useNavigate();
  const [selectedArticle, setSelectedArticle] = useState(null);

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-white text-secondary selection:bg-red-100 selection:text-primary animate-in fade-in duration-300">
        {/* Article Detail Header */}
        <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <button onClick={() => setSelectedArticle(null)} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft size={22} className="text-secondary" />
          </button>
          <div className="flex gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-full"><Bookmark size={20} /></button>
            <button className="p-2 hover:bg-gray-100 rounded-full"><Share2 size={20} /></button>
          </div>
        </div>

        <article className="pt-24 pb-20 px-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-primary uppercase tracking-widest">
            {selectedArticle.category}
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-6 leading-tight text-secondary">
            {selectedArticle.title}
          </h1>
          
          <div className="flex items-center gap-4 mb-10 pb-10 border-b border-gray-100">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
              {selectedArticle.author.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-sm text-secondary">{selectedArticle.author}</p>
              <p className="text-xs text-gray-500 font-medium">{selectedArticle.date} · {selectedArticle.readTime}</p>
            </div>
          </div>

          <img 
            src={selectedArticle.image} 
            alt={selectedArticle.title} 
            className="w-full h-[300px] object-cover rounded-[32px] mb-12 shadow-xl"
          />

          <div className="prose prose-lg text-gray-600 font-medium leading-relaxed whitespace-pre-line">
            {selectedArticle.content}
          </div>

          {/* Footer CTA */}
          <div className="mt-20 p-8 rounded-[40px] bg-secondary text-white text-center shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition duration-1000"></div>
            <h3 className="text-2xl font-black mb-4">Stay Safe Everywhere</h3>
            <p className="text-blue-100 text-sm mb-6 max-w-xs mx-auto">Download the SafeStep app today and join a community of protectors.</p>
            <button 
                onClick={() => navigate('/login')}
                className="px-10 py-4 bg-primary text-white font-black rounded-2xl hover:bg-red-600 transition shadow-xl active:scale-95"
            >
              Get Protected
            </button>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Blog Header */}
      <div className="bg-white border-b border-gray-100 px-6 pt-16 pb-12 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <button 
          onClick={() => navigate('/landing')}
          className="absolute top-6 left-6 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6 font-black text-[10px] text-primary uppercase tracking-[0.2em]">
          Knowledge Hub
        </div>
        <h1 className="text-4xl font-black text-secondary tracking-tight">Safety Awareness</h1>
        <p className="text-gray-500 font-medium mt-3 max-w-sm mx-auto leading-relaxed">
          Expert advice, community stories, and essential guides to keep you protected.
        </p>
      </div>

      {/* Article Grid */}
      <div className="px-6 py-12 max-w-5xl mx-auto grid gap-10">
        {ARTICLES.map((article) => (
          <div 
            key={article.id}
            onClick={() => setSelectedArticle(article)}
            className="group bg-white rounded-[40px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition duration-500 flex flex-col md:flex-row cursor-pointer"
          >
            <div className="md:w-1/2 h-64 md:h-auto overflow-hidden relative">
              <img 
                src={article.image} 
                alt={article.title} 
                className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
              />
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-black text-secondary uppercase tracking-widest border border-white/20">
                {article.category}
              </div>
            </div>
            <div className="md:w-1/2 p-8 flex flex-col justify-center">
              <div className="flex items-center gap-3 text-xs font-bold text-gray-400 mb-4 tracking-tight">
                <Clock size={14} className="text-primary" />
                {article.readTime} Read
              </div>
              <h2 className="text-2xl font-black text-secondary leading-[1.2] mb-4 group-hover:text-primary transition duration-300">
                {article.title}
              </h2>
              <p className="text-gray-500 font-medium text-sm leading-relaxed mb-6 italic">
                "{article.excerpt}"
              </p>
              <div className="flex items-center gap-3 font-black text-[10px] text-primary uppercase tracking-[0.2em] group-hover:translate-x-2 transition-transform duration-300">
                Read Full Story
                <ChevronRight size={14} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Blog Footer */}
      <div className="px-6 py-20 text-center">
        <Heart size={32} className="mx-auto mb-6 text-red-100 fill-red-100" />
        <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.4em] mb-2 px-1">Stay Connected</p>
        <p className="text-secondary font-black text-xl mb-4 italic">Your Safety is Our World.</p>
        <div className="w-12 h-1.5 bg-primary/20 mx-auto rounded-full"></div>
      </div>
    </div>
  );
}
