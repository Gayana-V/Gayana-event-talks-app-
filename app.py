import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup, Tag

app = Flask(__name__)

# Cache configuration
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION_SEC = 600  # 10 minutes

def parse_release_notes(xml_content):
    root = ET.fromstring(xml_content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        entry_id = entry.find('atom:id', ns).text
        date_str = entry.find('atom:title', ns).text  # e.g., "June 15, 2026"
        updated_str = entry.find('atom:updated', ns).text  # ISO timestamp
        
        link_elem = entry.find('atom:link', ns)
        link = link_elem.attrib.get('href') if link_elem is not None else ""
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # Parse items
        items = []
        current_item = None
        
        for child in soup.contents:
            if not isinstance(child, Tag):
                continue
            
            if child.name in ['h3', 'h4']:
                if current_item:
                    items.append(current_item)
                current_item = {
                    'type': child.get_text(strip=True),
                    'content_parts': []
                }
            else:
                if current_item is None:
                    current_item = {
                        'type': 'General',
                        'content_parts': []
                    }
                
                # Update any nested anchor links to open in a new tab securely
                for a in child.find_all('a'):
                    a['target'] = '_blank'
                    a['rel'] = 'noopener noreferrer'
                
                current_item['content_parts'].append(str(child))
                
        if current_item:
            items.append(current_item)
            
        # Consolidate HTML and text for each item
        parsed_items = []
        for idx, item in enumerate(items):
            item_html = "".join(item['content_parts']).strip()
            item_text = BeautifulSoup(item_html, 'html.parser').get_text(strip=True)
            
            # Clean up double spacing and formatting quirks in plain text
            item_text = " ".join(item_text.split())
            
            if not item_html and not item['type']:
                continue
                
            parsed_items.append({
                'id': f"{entry_id}_{idx}",
                'type': item['type'],
                'html': item_html,
                'text': item_text
            })
            
        entries.append({
            'id': entry_id,
            'date': date_str,
            'updated': updated_str,
            'link': link,
            'items': parsed_items
        })
        
    return entries

def fetch_feed_data(force_refresh=False):
    now = time.time()
    
    # Return cache if valid and no force refresh is requested
    if cache["data"] and not force_refresh and (now - cache["last_fetched"] < CACHE_DURATION_SEC):
        return cache["data"], True
        
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        parsed_data = parse_release_notes(response.content)
        cache["data"] = parsed_data
        cache["last_fetched"] = now
        return parsed_data, False
    except Exception as e:
        # If fetch fails but we have cached data, fall back to cache
        if cache["data"]:
            return cache["data"], True
        raise RuntimeError(f"Failed to fetch or parse release notes feed: {str(e)}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        releases, from_cache = fetch_feed_data(force_refresh)
        return jsonify({
            'status': 'success',
            'from_cache': from_cache,
            'last_updated': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cache["last_fetched"])),
            'releases': releases
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
