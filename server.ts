import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Server-side Gemini 4 Argon High-Thinking Logistics & Emergency Recovery Strategist
  app.post('/api/logistics-planner', async (req, res) => {
    const { scenario, origin, destination, cargoSpecs } = req.body || {};

    if (!scenario && !cargoSpecs) {
      return res.status(400).json({
        error: 'Please provide an emergency freight scenario or cargo specification.',
      });
    }

    const promptText = `You are the NEO Transport 24/7 Mission-Critical Dispatch Architect (neotransport.co.uk / admin.neotransport.co.uk).
Analyze the following UK/EU emergency courier or freight recovery request and provide a concise, high-precision operational dispatch plan:
- Origin Hub / Pickup: ${origin || 'Manchester Hub (M6/M62)'}
- Destination: ${destination || 'Birmingham'}
- Cargo & Scenario Details: ${scenario || cargoSpecs}

Include:
1. Recommended Vehicle Class (from: Small Van [1 pallet/400kg], SWB/LWB [3 pallets/1200kg], XLWB [4 pallets/1000kg], Luton Tail-Lift [6 pallets/1000kg], or 7.5T Rigid [10 pallets/2500kg]) with vehicle code.
2. Collection & Direct Transit SLA (referencing 60-minute nationwide collection target and direct point-to-point routing without hub transloading).
3. Load Restraint, Customs (if EU), or Tail-Lift Protocol.
4. Immediate Next Step (Booking via Customer Portal at https://admin.neotransport.co.uk/ or 24/7 Dispatch Hotline 0800 246 8135).
Keep the response structured, calm, authoritative, and under 160 words.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.json({
        mode: 'deterministic-sla-protocol',
        plan: `DISPATCH PROTOCOL VERIFIED • ${origin || 'MANCHESTER'} → ${destination || 'BIRMINGHAM'}\n\n1. VEHICLE ALLOCATION: Dedicated sole-use unit pre-staged for immediate departure (LUTON TAIL-LIFT [NT-25012] for tail-lift/6-pallet loads or 7.5T RIGID [NT-25102] for heavy commercial consignments up to 2,500kg).\n2. COLLECTION & TRANSIT SLA: Nationwide collection within ≤ 60 minutes from booking confirmation. Direct point-to-point transit with zero hub transloading or cargo co-mingling.\n3. TELEMETRY & POD: Real-time GPS tracking link activated upon dispatch; instant digital signature POD uploaded to Customer Portal upon consignee handoff.\n4. IMMEDIATE ACTION: Activate in 60 seconds via https://admin.neotransport.co.uk/ or call 24/7 Dispatch on 0800 246 8135 (Avg. response 3 min).`,
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: promptText,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction:
            'You are the NEO Transport 24/7 Mission-Critical Dispatch Architect. Provide concise, authoritative UK/EU same-day logistics and emergency standby recovery plans. Never mention generic template companies.',
        },
      });

      return res.json({
        mode: 'gemini-4-argon-high-thinking',
        plan: response.text || 'Dispatch plan generated. Proceed to Customer Portal at https://admin.neotransport.co.uk/.',
      });
    } catch (err: any) {
      return res.json({
        mode: 'deterministic-sla-protocol',
        plan: `DISPATCH PROTOCOL VERIFIED • ${origin || 'MANCHESTER'} → ${destination || 'BIRMINGHAM'}\n\n1. VEHICLE ALLOCATION: Dedicated sole-use unit pre-staged for immediate departure (LUTON TAIL-LIFT [NT-25012] or 7.5T RIGID [NT-25102]).\n2. COLLECTION & TRANSIT SLA: Nationwide collection within ≤ 60 minutes. Direct point-to-point routing with zero hub transloading.\n3. TELEMETRY & POD: Live GPS ETA telemetry and instant digital POD capture in Customer Portal.\n4. IMMEDIATE ACTION: Book now at https://admin.neotransport.co.uk/ or call 24/7 Dispatch on 0800 246 8135 (Avg. response 3 min).`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEO Transport server listening on http://localhost:${PORT}`);
  });
}

startServer();
