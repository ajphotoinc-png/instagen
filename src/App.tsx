import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Download, Image as ImageIcon, Loader2, Wand2 } from 'lucide-react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type AspectRatio = '1:1' | '4:5' | '5:4';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:5');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // Map our target ratio to Gemini supported ratio
      let geminiRatio = '1:1';
      if (aspectRatio === '4:5') geminiRatio = '3:4';
      if (aspectRatio === '5:4') geminiRatio = '4:3';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: geminiRatio,
          },
        },
      });

      let base64Image = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!base64Image) {
        throw new Error('No image generated.');
      }

      // Crop image to exact ratio if needed
      if (aspectRatio !== '1:1') {
        const croppedImage = await cropImage(base64Image, aspectRatio);
        setGeneratedImage(croppedImage);
      } else {
        setGeneratedImage(base64Image);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const cropImage = (base64Str: string, targetRatio: AspectRatio): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        let targetW = img.width;
        let targetH = img.height;

        if (targetRatio === '4:5') {
          // Target ratio is 0.8
          // Current ratio is 3:4 (0.75)
          // So current image is taller than we want. We need to crop height.
          targetH = img.width * (5 / 4);
        } else if (targetRatio === '5:4') {
          // Target ratio is 1.25
          // Current ratio is 4:3 (1.33)
          // So current image is wider than we want. We need to crop width.
          targetW = img.height * (5 / 4);
        }

        canvas.width = targetW;
        canvas.height = targetH;

        const offsetX = (img.width - targetW) / 2;
        const offsetY = (img.height - targetH) / 2;

        ctx.drawImage(img, offsetX, offsetY, targetW, targetH, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = base64Str;
    });
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `instagen-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans">
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">InstaGen</h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none transition-all"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-3">
              {(['1:1', '4:5', '5:4'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-3 px-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    aspectRatio === ratio
                      ? 'bg-purple-500/10 border-purple-500 text-purple-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <div
                    className={`border-2 rounded-sm ${aspectRatio === ratio ? 'border-purple-400' : 'border-zinc-500'}`}
                    style={{
                      width: ratio === '1:1' ? '24px' : ratio === '5:4' ? '28px' : '20px',
                      height: ratio === '1:1' ? '24px' : ratio === '5:4' ? '22px' : '25px',
                    }}
                  />
                  <span className="text-xs font-medium">
                    {ratio === '1:1' ? 'Square' : ratio === '4:5' ? 'Portrait' : 'Landscape'}
                    <br />
                    <span className="opacity-60">{ratio}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold flex items-center justify-center gap-2 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Generate Image
              </>
            )}
          </button>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center min-h-[400px] bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-4 relative overflow-hidden">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-4 text-zinc-500">
              <div className="w-16 h-16 relative">
                <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="animate-pulse text-sm font-medium tracking-wide">Crafting your vision...</p>
            </div>
          ) : generatedImage ? (
            <div className="relative group w-full h-full flex items-center justify-center">
              <img
                src={generatedImage}
                alt="Generated"
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleDownload}
                  className="bg-zinc-950/80 backdrop-blur-md hover:bg-zinc-900 text-white p-3 rounded-full shadow-lg border border-zinc-800 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                  title="Download Image"
                >
                  <Download className="w-5 h-5" />
                  <span className="text-sm font-medium pr-1">Download</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 text-zinc-600">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center rotate-3">
                <ImageIcon className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm">Your generated image will appear here</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
