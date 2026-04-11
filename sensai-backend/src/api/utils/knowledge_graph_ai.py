"""
LLM-powered extraction of atomic concepts from chat conversations.
Runs as part of the "Convert to Knowledge" flow to populate the knowledge graph.
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from api.llm import run_llm_with_openai
from api.config import openai_plan_to_model_name
from api.db.knowledge_graph import (
    upsert_concept,
    update_user_knowledge,
    upsert_concept_relation,
    create_knowledge_concept_link,
    get_concept_by_slug,
)
import re
import logging

logger = logging.getLogger(__name__)


class ExtractedConcept(BaseModel):
    name: str = Field(..., description="A clear, concise name for the concept (e.g. 'Closures in JavaScript')")
    slug: str = Field(..., description="A unique URL-friendly slug (e.g. 'closure-js')")
    description: str = Field(..., description="2-3 sentence summary of what was learned about this concept")
    related_to_slugs: List[str] = Field(
        default_factory=list,
        description="Slugs of other concepts this one is related to (from this or previous discussions)"
    )


class KnowledgeGraphExtraction(BaseModel):
    concepts: List[ExtractedConcept] = Field(..., description="List of distinct educational concepts found in the chat")


KNOWLEDGE_GRAPH_PROMPT = """
Analyze the following conversation between a student and an AI tutor.
Extract the core educational concepts discussed.

For each concept:
1. Provide a clear, concise name (e.g., "Dynamic Programming", "Binary Search Trees").
2. Create a unique URL-friendly slug using only lowercase letters, numbers, and hyphens (e.g., "dynamic-programming", "binary-search-trees").
3. Write a 2-3 sentence summary of what was learned about this concept in this conversation.
4. Identify how it relates to OTHER concepts in the discussion by listing their slugs in `related_to_slugs`.

Rules:
- Focus on ATOMIC, reusable concepts — not broad topics.
- Extract 2-7 concepts per conversation.
- Each concept should represent a distinct, learnable unit of knowledge.
- Slugs must be consistent: if "Dynamic Programming" is discussed, always use "dynamic-programming".

Conversation:
{conversation_text}
"""


async def extract_concepts_from_chat(
    chat_history: List[dict],
    user_id: int,
    knowledge_id: int,
) -> List[dict]:
    """
    Extract concepts from a chat conversation and store them in the knowledge graph.
    Returns the list of extracted concept dicts.
    """
    try:
        # Format conversation for LLM
        conversation_text = ""
        for msg in chat_history:
            role_label = "Student" if msg.get("role") == "user" else "Tutor"
            content = msg.get("content", "")
            conversation_text += f"{role_label}: {content}\n\n"

        if not conversation_text.strip():
            return []

        messages = [
            {
                "role": "system",
                "content": "You are a knowledge engineering assistant that extracts educational concepts from tutoring conversations."
            },
            {
                "role": "user",
                "content": KNOWLEDGE_GRAPH_PROMPT.format(conversation_text=conversation_text)
            }
        ]

        extraction = await run_llm_with_openai(
            model=openai_plan_to_model_name["router"],
            messages=messages,
            response_model=KnowledgeGraphExtraction,
            max_output_tokens=2000,
            api_mode="chat_completions"
        )

        extracted_concepts = []

        for concept in extraction.concepts:
            # 1. Upsert the concept
            concept_id = await upsert_concept(
                name=concept.name,
                slug=concept.slug,
                description=concept.description
            )

            # 2. Update user mastery (+0.15 per encounter, capped at 1.0)
            await update_user_knowledge(user_id, concept_id, mastery_delta=0.15)

            # 3. Link concept to the personal_knowledge entry
            await create_knowledge_concept_link(
                concept_id=concept_id,
                knowledge_id=knowledge_id,
                context_snippet=concept.description
            )

            # 4. Create edges to related concepts
            for related_slug in concept.related_to_slugs:
                related = await get_concept_by_slug(related_slug)
                if related:
                    await upsert_concept_relation(
                        source_id=concept_id,
                        target_id=related["id"],
                        relation_type="related_to"
                    )

            extracted_concepts.append({
                "id": concept_id,
                "name": concept.name,
                "slug": concept.slug,
                "description": concept.description,
            })

        return extracted_concepts

    except Exception as e:
        logger.error(f"Error during knowledge graph extraction: {str(e)}", exc_info=True)
        return []


async def backfill_user_knowledge_graph(user_id: int):
    """
    Finds all knowledge entries for a user that haven't been extracted into the graph
    and runs the extraction pipeline on them.
    """
    from api.db.knowledge_graph import get_unlinked_knowledge_entries
    
    entries = await get_unlinked_knowledge_entries(user_id)
    if not entries:
        return 0
        
    extracted_count = 0
    for entry in entries:
        chat_history = entry.get("chat_history")
        
        # If no chat history is available, synthesize a conversation from the note content
        if not chat_history:
            tags_str = ", ".join(entry.get("tags") or [])
            synthetic_text = f"Title: {entry.get('title')}\nTags: {tags_str}\n\nNotes:\n{entry.get('content')}"
            chat_history = [
                {"role": "user", "content": "Here are my notes. What concepts did I learn?"},
                {"role": "assistant", "content": synthetic_text}
            ]
            
        success = await extract_concepts_from_chat(
            chat_history=chat_history,
            user_id=user_id,
            knowledge_id=entry["id"]
        )
        if success:
            extracted_count += len(success)
            
    return extracted_count
