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
        plan: `Route: ${origin || 'Manchester'} to ${destination || 'Birmingham'}.\n\n1. Vehicle: Luton box van with 500kg tail-lift, unit NT-25012, up to 6 pallets and 1,000kg, or 7.5-tonne rigid truck, unit NT-25102, up to 10 pallets and 2,500kg.\n2. Timing: Collection within 60 minutes nationwide. Direct drive with no sorting hubs.\n3. Tracking: Live GPS tracking link sent on dispatch. Signed proof of delivery uploaded to the Customer Portal at drop-off.\n4. Booking: Book online at https://admin.neotransport.co.uk/ or call 0800 246 8135.`,
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
            'You are the NEO Transport 24/7 dispatch controller. Write clear, plain-English UK and EU courier plans with concrete vehicle specs, collection times, and direct routes. Avoid em dashes, parentheses, and jargon.',
        },
      });

      return res.json({
        mode: 'gemini-4-argon-high-thinking',
        plan: response.text || 'Dispatch plan ready. Book online at https://admin.neotransport.co.uk/.',
      });
    } catch (err: any) {
      return res.json({
        mode: 'deterministic-sla-protocol',
        plan: `Route: ${origin || 'Manchester'} to ${destination || 'Birmingham'}.\n\n1. Vehicle: Luton box van with 500kg tail-lift, unit NT-25012, or 7.5-tonne rigid truck, unit NT-25102.\n2. Timing: Collection within 60 minutes. Direct drive with no sorting hubs.\n3. Tracking: Live GPS map and signed proof of delivery in the Customer Portal.\n4. Booking: Book at https://admin.neotransport.co.uk/ or call 0800 246 8135.`,
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
