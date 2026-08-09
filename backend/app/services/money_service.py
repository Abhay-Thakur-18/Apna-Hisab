from typing import Union

def paise_to_rupees(paise: int) -> float:
    """
    Converts paise (int) to rupees (float).
    """
    return paise / 100.0

def rupees_to_paise(rupees: Union[int, float]) -> int:
    """
    Safely converts rupees (float or int) to paise (int), avoiding floating point rounding errors.
    """
    # Rounding to 2 decimal places first to prevent float issues like 80.50 -> 8049.99999
    return int(round(rupees * 100))

def format_rupees(paise: int) -> str:
    """
    Formats paise into standard Indian Rupee format (e.g. ₹12,50,000.50 or ₹80.00).
    """
    rupees_val = paise_to_rupees(paise)
    
    # Simple Indian Numbering formatting (standard 2 decimal representation with lakhs/crores formatting is optional,
    # let's do a robust formatting matching standard currency rules).
    neg = "-" if rupees_val < 0 else ""
    abs_val = abs(rupees_val)
    
    parts = f"{abs_val:.2f}".split(".")
    integer_part = parts[0]
    decimal_part = parts[1]
    
    # Indian formatting: last 3 digits grouped, then group by 2 digits (e.g., 12,34,567)
    if len(integer_part) <= 3:
        formatted_int = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        
        # Reverse remaining string to process from right to left in pairs of 2
        reversed_remaining = remaining[::-1]
        groups = [reversed_remaining[i:i+2] for i in range(0, len(reversed_remaining), 2)]
        
        # Join groups, reverse back, and append the last three digits
        formatted_remaining = ",".join(groups)[::-1]
        formatted_int = f"{formatted_remaining},{last_three}"
        
    return f"{neg}₹{formatted_int}.{decimal_part}"
