import google.generativeai as genai
from typing import Any, Optional
import json
import asyncio

from src.config import settings

if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)


class LLMService:
    def __init__(self):
        self.flash_model = genai.GenerativeModel(settings.gemini_models["FLASH"]) if settings.gemini_api_key else None
        self.pro_model = genai.GenerativeModel(settings.gemini_models["PRO"]) if settings.gemini_api_key else None

    async def generate(self, prompt: str, model: str = "flash", timeout: int = 15) -> str:
        """Generate text response."""
        if not settings.gemini_api_key or not self.flash_model or not self.pro_model:
            raise ValueError("Gemini API key is not configured")

        m = self.flash_model if model == "flash" else self.pro_model
        try:
            response = await asyncio.wait_for(asyncio.to_thread(m.generate_content, prompt), timeout=timeout)
            return response.text
        except Exception as e:
            print(f"LLM generation error: {e}")
            raise

    async def generate_json(self, prompt: str, model: str = "flash") -> Any:
        """Generate JSON response."""
        prompt += "\n\nReturn valid JSON only."
        text = await self.generate(prompt, model)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            match = re.search(r'\[.*\]|\{.*\}', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except:
                    pass
            return []

    async def generate_structured(self, prompt: str, schema: dict, model: str = "pro") -> Any:
        """Generate structured output with schema."""
        full_prompt = f"""{prompt}

Output schema:
{json.dumps(schema, indent=2)}

Return valid JSON matching this schema."""
        return await self.generate_json(full_prompt, model)


llm_service = LLMService()