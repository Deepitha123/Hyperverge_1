from pydantic import BaseModel, Field
from api.llm import run_llm_with_openai
from api.config import openai_plan_to_model_name

class CommentConfidenceScore(BaseModel):
    score: int = Field(..., description="A confidence score from 1 to 10 on how relatable and helpful the comment is to the post content.")
    reasoning: str = Field(..., description="Brief reasoning for the assigned score.")

async def score_hub_comment(post_title: str, post_body: str, comment_body: str) -> int:
    """
    Uses AI to evaluate a comment's relevance and helpfulness to a post.
    Returns a score from 1 to 10.
    """
    model = openai_plan_to_model_name["router"]
    
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert educational content moderator. Your task is to evaluate a peer comment on a learning platform. "
                "Compare the comment to the original post (title and body) and provide a confidence score from 1 to 10. "
                "1 means the comment is irrelevant, spam, or harmful. "
                "10 means the comment is highly relevant, provides a deep explanation, or correctly answers a question in the post. "
                "Be strict about quality. Short 'thanks' or 'ok' comments should get lower scores (around 2-3) compared to substantive contributions."
            )
        },
        {
            "role": "user",
            "content": (
                f"POST TITLE: {post_title}\n"
                f"POST BODY: {post_body}\n\n"
                f"PEER COMMENT: {comment_body}\n\n"
                "Evaluate this comment and provide a confidence score (1-10) and brief reasoning."
            )
        }
    ]
    
    try:
        result: CommentConfidenceScore = await run_llm_with_openai(
            model=model,
            messages=messages,
            response_model=CommentConfidenceScore,
            max_output_tokens=500,
            api_mode="chat_completions"
        )
        # Ensure score is within bounds
        score = max(1, min(10, result.score))
        return score
    except Exception as e:
        print(f"Error scoring hub comment: {e}")
        # Default to a neutral score if AI fails
        return 5
