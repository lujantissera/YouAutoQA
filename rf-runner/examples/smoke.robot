*** Settings ***
Library    Browser

*** Test Cases ***
Open Example Page
    New Browser    chromium    headless=True
    New Page    https://example.com
    Get Title    ==    Example Domain
