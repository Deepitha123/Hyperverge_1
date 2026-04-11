"""
Chroma DB utility for semantic search on personal knowledge entries.
Handles embedding generation, storage, and retrieval.
"""

import chromadb
from typing import List, Optional, Dict, Any
import os
from pathlib import Path
from api.utils.logging import logger

# Initialize Chroma client with persistent storage
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_data")

# Ensure the directory exists
Path(CHROMA_DB_PATH).mkdir(parents=True, exist_ok=True)

# Create persistent Chroma client
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)


def get_knowledge_collection(learner_id: int) -> chromadb.Collection:
    """
    Get or create a collection for a specific learner's knowledge.
    Each learner has their own collection for semantic search.
    """
    collection_name = f"learner_{learner_id}_knowledge"
    collection = chroma_client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )
    return collection


async def add_knowledge_to_chroma(
    learner_id: int,
    knowledge_id: int,
    title: str,
    content: str,
    tags: Optional[List[str]] = None,
    course_id: Optional[int] = None,
    module_id: Optional[int] = None,
) -> bool:
    """
    Add a knowledge entry to Chroma DB with semantic embeddings.
    Chroma automatically generates embeddings using the default embedding model.
    
    Args:
        learner_id: ID of the learner
        knowledge_id: ID of the knowledge entry
        title: Title of the knowledge entry
        content: Full content of the knowledge entry
        tags: Tags associated with the knowledge
        course_id: Course ID (optional)
        module_id: Module ID (optional)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        collection = get_knowledge_collection(learner_id)
        
        # Combine title and content for embedding
        # Give more weight to title by including it twice
        full_text = f"{title}\n\n{content}"
        
        # Prepare metadata
        metadata = {
            "learner_id": learner_id,
            "title": title,
            "tags": ",".join(tags) if tags else "",
        }
        if course_id:
            metadata["course_id"] = course_id
        if module_id:
            metadata["module_id"] = module_id
        
        # Add to collection
        # Chroma uses the content for embedding and document ID for retrieval
        collection.add(
            ids=[str(knowledge_id)],
            documents=[full_text],
            metadatas=[metadata],
        )
        
        logger.info(f"Added knowledge {knowledge_id} to Chroma for learner {learner_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error adding knowledge to Chroma: {e}")
        return False


async def search_knowledge(
    learner_id: int,
    query: str,
    n_results: Optional[int] = None,
    course_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Perform semantic search on a learner's knowledge base.
    
    Args:
        learner_id: ID of the learner
        query: Search query (natural language)
        n_results: Maximum number of results to return (None = all)
        course_id: Optional filter by course ID
    
    Returns:
        List of matching knowledge entries with scores
    """
    try:
        collection = get_knowledge_collection(learner_id)
        
        # Query settings
        query_kwargs = {
            "query_texts": [query],
            "include": ["documents", "metadatas", "distances"],
        }
        
        if n_results:
            query_kwargs["n_results"] = n_results
        
        # Perform semantic search
        results = collection.query(**query_kwargs)
        
        # Format results
        formatted_results = []
        if results["ids"] and len(results["ids"]) > 0:
            for i, doc_id in enumerate(results["ids"][0]):
                # Convert distance to similarity score (0-1)
                # Chroma uses cosine distance, so we convert: similarity = 1 - distance
                distance = results["distances"][0][i] if results["distances"] else 0
                similarity_score = 1 - distance
                
                metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                document = results["documents"][0][i] if results["documents"] else ""
                
                # Filter by course if specified
                if course_id and metadata.get("course_id") != course_id:
                    continue
                
                formatted_results.append({
                    "id": int(doc_id),
                    "title": metadata.get("title", ""),
                    "summary": document[:500] + "..." if len(document) > 500 else document,
                    "tags": metadata.get("tags", "").split(",") if metadata.get("tags") else [],
                    "similarity_score": round(similarity_score, 3),
                    "course_id": metadata.get("course_id"),
                    "module_id": metadata.get("module_id"),
                })
        
        logger.info(f"Search for '{query}' returned {len(formatted_results)} results")
        return formatted_results
        
    except Exception as e:
        logger.error(f"Error searching knowledge: {e}")
        return []


async def delete_knowledge_from_chroma(learner_id: int, knowledge_id: int) -> bool:
    """
    Remove a knowledge entry from Chroma DB.
    
    Args:
        learner_id: ID of the learner
        knowledge_id: ID of the knowledge entry to delete
    
    Returns:
        True if successful, False otherwise
    """
    try:
        collection = get_knowledge_collection(learner_id)
        collection.delete(ids=[str(knowledge_id)])
        logger.info(f"Deleted knowledge {knowledge_id} from Chroma")
        return True
    except Exception as e:
        logger.error(f"Error deleting knowledge from Chroma: {e}")
        return False


async def update_knowledge_in_chroma(
    learner_id: int,
    knowledge_id: int,
    title: str,
    content: str,
    tags: Optional[List[str]] = None,
    course_id: Optional[int] = None,
    module_id: Optional[int] = None,
) -> bool:
    """
    Update a knowledge entry in Chroma DB.
    
    Args:
        learner_id: ID of the learner
        knowledge_id: ID of the knowledge entry
        title: Updated title
        content: Updated content
        tags: Updated tags
        course_id: Course ID
        module_id: Module ID
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Delete old entry and add new one
        await delete_knowledge_from_chroma(learner_id, knowledge_id)
        return await add_knowledge_to_chroma(
            learner_id=learner_id,
            knowledge_id=knowledge_id,
            title=title,
            content=content,
            tags=tags,
            course_id=course_id,
            module_id=module_id,
        )
    except Exception as e:
        logger.error(f"Error updating knowledge in Chroma: {e}")
        return False


async def get_all_learner_knowledge_metadata(learner_id: int) -> List[Dict[str, Any]]:
    """
    Get metadata for all knowledge entries of a learner (without full content).
    Useful for listing knowledge without heavy document retrieval.
    
    Args:
        learner_id: ID of the learner
    
    Returns:
        List of knowledge metadata
    """
    try:
        collection = get_knowledge_collection(learner_id)
        
        # Get all items by querying with a generic text
        results = collection.get(
            include=["metadatas"],
        )
        
        formatted_results = []
        if results["ids"]:
            for i, doc_id in enumerate(results["ids"]):
                metadata = results["metadatas"][i] if results["metadatas"] else {}
                formatted_results.append({
                    "id": int(doc_id),
                    "title": metadata.get("title", ""),
                    "tags": metadata.get("tags", "").split(",") if metadata.get("tags") else [],
                    "course_id": metadata.get("course_id"),
                    "module_id": metadata.get("module_id"),
                })
        
        return formatted_results
        
    except Exception as e:
        logger.error(f"Error getting learner knowledge metadata: {e}")
        return []
