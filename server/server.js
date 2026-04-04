require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
app.use(cors({
  origin: '*', // Allow all for hackathon/tunneling
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Health check
// Last deploy trigger: 2026-04-03
app.get('/', (req, res) => res.json({ status: 'SafeStep Server is live!', version: '2.1' }));

// Helper to format phone numbers to E.164
const formatPhone = (phone) => {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, ''); // Remove non-digits
  
  // If it's 10 digits, assume India
  if (cleaned.length === 10) return `+91${cleaned}`;
  
  // If it's already got a country code but no +, add one
  if (cleaned.length > 10 && !phone.startsWith('+')) return `+${cleaned}`;
  
  return phone.startsWith('+') ? phone : `+${cleaned}`;
};

// Initialize Twilio
let twilioClient;
try {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} catch (error) {
  console.log("Twilio credentials not fully set. SMS will be simulated.");
}

app.post('/api/test-sms', async (req, res) => {
  const phone = formatPhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  try {
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER !== 'your_twilio_phone_number') {
      await twilioClient.messages.create({
        body: "SafeStep Test: If you see this, your SMS integration is working! 🚀",
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      res.json({ success: true, message: 'Test SMS sent!' });
    } else {
      res.json({ success: true, simulated: true, message: 'Simulation mode: SMS not sent.' });
    }
  } catch (err) {
    console.error('Test SMS failure:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sos', async (req, res) => {
  const { userName, locationLink, userPhone } = req.body;
  const contacts = req.body.contacts || [];
  
  const messageBody = `🚨 SOS ALERT from ${userName}!
📍 Location: ${locationLink}
🆘 Help is needed immediately!
Time: ${new Date().toLocaleString()}`;

  try {
    let sentCount = 0;
    
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER !== 'your_twilio_phone_number') {
      console.log(`📡 SOS Request: From ${userName} (${userPhone}). Processing ${contacts.length} contacts...`);
      
      // Always try to send to the sender's own phone first (as a verified receipt)
      const formattedUserPhone = formatPhone(userPhone);
      if (formattedUserPhone) {
        console.log(`📤 Sending copy to sender: ${formattedUserPhone}`);
        await twilioClient.messages.create({
          body: `✅ SOS CONFIRMED: We are alerting your contacts. Your location: ${locationLink}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedUserPhone
        }).catch(err => console.log("User receipt failed (probably unverified):", err.message));
        sentCount++;
      }

      for (const contact of contacts) {
        const formattedContactPhone = formatPhone(contact.phone);
        if (formattedContactPhone) {
          try {
            console.log(`📤 Dispatching real SMS to: ${formattedContactPhone}`);
            await twilioClient.messages.create({
              body: messageBody,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: formattedContactPhone
            });
            sentCount++;
          } catch (e) {
            console.log(`❌ Failed to send to ${contact.name}: ${e.message}`);
            if (e.code === 21608 && formattedUserPhone) {
              console.log(`⚠️ Unverified contact. Retrying SOS to sender's own number...`);
              await twilioClient.messages.create({
                body: `🚨 SOS FORWARDED: Your contact (${contact.name}) is not verified on Twilio. Original Alert:\n${messageBody}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: formattedUserPhone
              });
              sentCount++;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error sending SOS SMS:', error);
    if (error.code === 21608) {
      res.status(403).json({ 
        error: 'TWILIO TRIAL ERROR: The number you are texting is not "Verified" in your Twilio Console. Please add it to "Verified Caller IDs" on Twilio.com' 
      });
    } else {
      res.status(500).json({ error: 'Failed to send SOS' });
    }
  }
});

app.post('/api/sos-evidence', async (req, res) => {
  const { userId, evidenceLink, contacts } = req.body;
  
  if (!contacts || contacts.length === 0) return res.status(200).json({ success: true, message: 'No contacts to notify' });

  const messageBody = `📁 EVIDENCE CAPTURED!
A new audio/video recording has been uploaded for your emergency alert.
View evidence: ${evidenceLink}
Time: ${new Date().toLocaleString()}`;

  try {
    let sentCount = 0;
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER !== 'your_twilio_phone_number') {
      for (const contact of contacts) {
        const formattedContactPhone = formatPhone(contact.phone);
        if (formattedContactPhone) {
          await twilioClient.messages.create({
            body: messageBody,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedContactPhone
          });
          sentCount++;
        }
      }
      res.json({ success: true, message: `Evidence link sent to ${sentCount} contacts`, messageBody });
    } else {
      console.log(`[SIMULATED EVIDENCE SMS] Body:\n${messageBody}\nTo: ${contacts.map(c => c.phone).join(', ')}`);
      res.json({ success: true, simulated: true, messageBody });
    }
  } catch (error) {
    console.log("Failed to send evidence SMS", error);
    res.status(500).json({ error: 'Failed to send link' });
  }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;