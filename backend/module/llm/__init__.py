from .gemini import chat_with_gemini2_5
from .gpt import chat_with_gpt4o

def summarize(prompt: str) -> str:
    """Summarizing with LLM (Gemini)"""
    result = chat_with_gemini2_5(prompt)
    return result
