# Speaks text with a Microsoft Edge neural voice and prints when each word is
# spoken. Called by src/zhvoice.js; reads the text from stdin.
#   python edge_speak.py <voice> <rate like +0%> <out.mp3> [pitch like +0Hz]
# Prints JSON: [{"text": "...", "start": seconds, "end": seconds}, ...]
import asyncio
import json
import sys

import edge_tts


async def main():
    voice, rate, out = sys.argv[1:4]
    pitch = sys.argv[4] if len(sys.argv) > 4 else "+0Hz"
    text = sys.stdin.read()
    words = []
    with open(out, "wb") as f:
        stream = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary").stream()
        async for chunk in stream:
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append({"text": chunk["text"], "start": start, "end": start + chunk["duration"] / 1e7})
    print(json.dumps(words, ensure_ascii=False))


asyncio.run(main())
