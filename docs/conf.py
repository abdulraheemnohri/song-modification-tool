import os
import sys
sys.path.insert(0, os.path.abspath('..'))

project = 'AI Song Modification Tool'
copyright = '2024, Abdul Raheem'
author = 'Abdul Raheem'

extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.viewcode',
    'sphinx.ext.napoleon',
]

html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']
