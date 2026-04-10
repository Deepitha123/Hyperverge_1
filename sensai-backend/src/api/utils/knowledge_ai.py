from typing import List, Optional
from pydantic import BaseModel, Field
from api.llm import run_llm_with_openai
from api.config import openai_plan_to_model_name

class KnowledgeEntry(BaseModel):
    title: str = Field(..., description="A concise, descriptive title for this knowledge note.")
    explanation: str = Field(..., description="A clean, structured explanation of the concept discussed in the chat, formatted in Markdown.")
    takeaways: List[str] = Field(..., description="Key takeaways or important rules to remember.")
    mistakes_to_avoid: List[str] = Field(..., description="Common pitfalls or specific mistakes the student made during this interaction.")
    tags: List[str] = Field(..., description="3-5 relevant technical tags for categorization.")

async def summarize_chat_to_knowledge(chat_history: List[dict]) -> KnowledgeEntry:
    """
    Uses AI to transform a raw chat history into a structured knowledge note.
    """
    model = openai_plan_to_model_name["router"]
    
    # Format chat history for the prompt
    formatted_chat = ""
    for msg in chat_history:
        role = "Student" if msg["role"] == "user" else "Tutor"
        content = msg.get("content", "")
        # Handle JSON content from assistant messages if necessary
        formatted_chat += f"{role}: {content}\n\n"

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert tutor and technical writer. Your task is to take a dialogue between a student and a tutor "
                "and distill it into a high-quality 'Knowledge Note' for the student's personal repository. "
                "Focus on clarity, actionable takeaways, and correcting misconceptions. "
                "The explanation should be in clean Markdown."
            )
        },
        {
            "role": "user",
            "content": (
                "Here is the chat history:\n\n"
                f"{formatted_chat}\n\n"
                "Please generate a structured Knowledge Entry including a title, explanation, takeaways, mistakes to avoid, and tags."
            )
        }
    ]
    
    return await run_llm_with_openai(
        model=model,
        messages=messages,
        response_model=KnowledgeEntry,
        max_output_tokens=1500,
        api_mode="chat_completions"
    )
