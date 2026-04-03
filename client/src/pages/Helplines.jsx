import { useState } from 'react';
import { ArrowLeft, Phone, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const helplinesData = [
  { name: 'Women Helpline', number: '1091', desc: 'All India Women Helpline' },
  { name: 'Police Emergency', number: '100', desc: 'General Police Emergency' },
  { name: 'Nirbhaya Helpline', number: '1800-111-77', desc: 'Nirbhaya Center' }
];

export default function Helplines() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = helplinesData.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) || 
    h.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-y-auto pb-20">
      <div className="flex items-center p-4 bg-primary shadow-md shrink-0 gap-3 text-white sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-red-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">{t('helpline_directory')}</h1>
      </div>

      <div className="p-4 bg-white border-b sticky top-[68px] z-10">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder={t('search_helplines')} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
          />
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {filtered.map((helpline, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center relative overflow-hidden group">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
            <div className="pl-2">
              <h3 className="font-bold text-secondary text-lg">{helpline.name}</h3>
              <p className="text-gray-500 text-sm mb-1">{helpline.desc}</p>
              <div className="text-2xl font-black tracking-wider text-gray-800">{helpline.number}</div>
            </div>
            
            <a 
              href={`tel:${helpline.number.replace(/-/g, '')}`} 
              className="flex flex-col items-center justify-center p-3 bg-red-50 text-primary rounded-xl min-w-[80px] hover:bg-primary hover:text-white transition shadow-sm border border-red-100"
            >
              <Phone size={24} className="mb-1" fill="currentColor" />
              <span className="text-xs font-bold whitespace-nowrap">{t('answer') === 'Answer' ? 'CALL' : (t('answer') === 'उत्तर दें' ? 'कॉल' : 'కాల్')}</span>
            </a>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center p-10 text-gray-500">
            {t('no_helplines')}
          </div>
        )}
      </div>
    </div>
  );
}
