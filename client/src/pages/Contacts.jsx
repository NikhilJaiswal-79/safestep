import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft, UserPlus, Trash2, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Contacts() {
  const { currentUser, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRel, setNewRel] = useState('Mom');

  useEffect(() => {
    if (currentUser) {
      loadContacts();
    }
  }, [currentUser]);

  const loadContacts = async () => {
    const docRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().contacts) {
      setContacts(snap.data().contacts);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (contacts.length >= 5) {
      alert("Maximum 5 contacts allowed");
      return;
    }
    const updated = [...contacts, { name: newName, phone: newPhone, relation: newRel }];
    await updateProfile(currentUser.uid, { contacts: updated });
    setContacts(updated);
    setShowAdd(false);
    setNewName('');
    setNewPhone('');
  };

  const handleDelete = async (index) => {
    const updated = contacts.filter((_, i) => i !== index);
    await updateProfile(currentUser.uid, { contacts: updated });
    setContacts(updated);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-y-auto pb-20">
      <div className="flex items-center p-4 bg-white shadow-sm shrink-0 gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-secondary">Trusted Contacts</h1>
      </div>

      <div className="p-6 flex-1">
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-500 text-sm">Add up to 5 trusted contacts.</p>
          <span className="text-primary font-bold text-sm bg-red-50 px-2 py-1 rounded-md">{contacts.length}/5</span>
        </div>

        <div className="flex flex-col gap-4">
          {contacts.map((contact, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                  {contact.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-secondary text-lg">{contact.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700">{contact.relation}</span>
                    <span>{contact.phone}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`tel:${contact.phone}`} className="p-2 text-green-600 bg-green-50 rounded-full">
                  <Phone size={18} />
                </a>
                <button onClick={() => handleDelete(i)} className="p-2 text-red-500 bg-red-50 rounded-full">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {contacts.length === 0 && !showAdd && (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">No contacts added yet.</p>
            </div>
          )}

          {showAdd ? (
            <form onSubmit={handleAdd} className="bg-white p-5 rounded-xl border border-gray-200 shadow-md flex flex-col gap-3 mt-4">
              <h3 className="font-bold text-secondary text-lg border-b pb-2 mb-2">New Contact</h3>
              <input required type="text" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} className="p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              <input required type="tel" placeholder="Phone Number" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              <select value={newRel} onChange={e => setNewRel(e.target.value)} className="p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white">
                <option>Mom</option><option>Dad</option><option>Sibling</option><option>Friend</option><option>Other</option>
              </select>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-gray-100 font-bold text-gray-600 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-red-700">Save</button>
              </div>
            </form>
          ) : (
             contacts.length < 5 && (
              <button 
                onClick={() => setShowAdd(true)}
                className="mt-2 w-full py-4 border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded-xl flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition"
              >
                <UserPlus size={20} /> Add Contact
              </button>
             )
          )}
        </div>
      </div>
    </div>
  );
}
