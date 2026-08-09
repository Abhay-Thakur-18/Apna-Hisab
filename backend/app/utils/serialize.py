from bson import ObjectId

def serialize_doc(doc: dict) -> dict:
    """
    Recursively converts MongoDB ObjectId fields to string format
    so they can be easily processed by Pydantic and JSON encoders.
    """
    if doc is None:
        return None
        
    serialized = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, dict):
            serialized[key] = serialize_doc(value)
        elif isinstance(value, list):
            serialized[key] = [
                serialize_doc(item) if isinstance(item, dict) else (str(item) if isinstance(item, ObjectId) else item)
                for item in value
            ]
        else:
            serialized[key] = value
            
    # Map _id to id if the schema expects it, but keep it flexible
    if "_id" in serialized and "id" not in serialized:
        serialized["id"] = serialized["_id"]
        
    return serialized

def serialize_list(docs: list) -> list:
    """
    Serializes a list of MongoDB documents.
    """
    return [serialize_doc(doc) for doc in docs]
