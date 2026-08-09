import pytest
from app.services.money_service import paise_to_rupees, rupees_to_paise, format_rupees

def test_paise_to_rupees():
    assert paise_to_rupees(8000) == 80.0
    assert paise_to_rupees(125075) == 1250.75
    assert paise_to_rupees(0) == 0.0
    assert paise_to_rupees(-500) == -5.0

def test_rupees_to_paise():
    assert rupees_to_paise(80) == 8000
    assert rupees_to_paise(80.0) == 8000
    assert rupees_to_paise(1250.75) == 125075
    assert rupees_to_paise(0.0) == 0
    assert rupees_to_paise(-5.5) == -550
    # Floating point precision checks
    assert rupees_to_paise(80.50) == 8050
    assert rupees_to_paise(0.29) == 29

def test_format_rupees():
    assert format_rupees(8000) == "₹80.00"
    assert format_rupees(125075) == "₹1,250.75"
    assert format_rupees(0) == "₹0.00"
    assert format_rupees(-500) == "-₹5.00"
    assert format_rupees(10000000) == "₹1,00,000.00" # 1 Lakh Rupees
    assert format_rupees(123456789) == "₹12,34,567.89"
