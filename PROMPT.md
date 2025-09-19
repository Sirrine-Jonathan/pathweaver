Build a game that features an interface for communicating with an LLM.
The interface first displays a 'Start Game' button on a title page.
When the user clicks 'Start Game' a message is sent to the LLM. This message
is stored in ./GAME_PROMPT.md

The LLM should have tools to update the interface. At the vary least, give it 
a tool to display a dynamic component. There should also be tools perform CRUD
operations on a basic database system most appropriate for it to fulfill the 
GAME_PROMPT.

Look at the otis project found in /Users/jsirrine/dev/user-workspace/tools/otis
for inspiration on how to set up the basic server side LLM configuration, client
interface, and dynamic component tool.

DO NOT hook up any MCPs as that is not needed for this project.