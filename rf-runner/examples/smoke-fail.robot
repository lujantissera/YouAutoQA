*** Settings ***
Library    Browser

*** Test Cases ***
Open Example Page And Expect Wrong Title
    New Browser    chromium    headless=True
    New Page    https://example.com
    Get Title    ==    This Title Does Not Exist
