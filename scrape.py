#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import json
import requests
from bs4 import BeautifulSoup
import re
import os
import errno
import time


# http://stackoverflow.com/a/600612
def mkdir_p(path):
    try:
        os.makedirs(path)
    except OSError as exc:  # Python >2.5
        if exc.errno == errno.EEXIST and os.path.isdir(path):
            pass
        else:
            raise


# http://stackoverflow.com/a/16696317
def download_file(url, filepath):
    if os.path.exists(filepath):
        return
    print('Download %s to %s' % (url, filepath))
    r = requests.get(url, stream=True)
    with open(filepath, 'wb') as f:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk:  # filter out keep-alive new chunks
                f.write(chunk)
                # f.flush() commented by recommendation from J.F.Sebastian


def save_image(path):
    dir = os.path.dirname(path)
    file = os.path.basename(path)
    mkdir_p('wonderfl.net/%s' % dir)
    filepath = 'wonderfl.net%s/%s' % (dir, file)
    download_file('http://wonderfl.net' + path, filepath)


def remove_element(soup, selector):
    for el in soup.select(selector):
        el.extract()


def rewrite_abs_urls(soup, base):
    for a in soup.find_all(href=re.compile('^http:\/\/wonderfl\.net')):
        a['href'] = base + a['href'][20:]

    for a in soup.find_all(src=re.compile('^http:\/\/wonderfl\.net')):
        a['src'] = re.sub(r'\?t=\d+$', '', a['src'][19:])

    for a in soup.find_all(href=re.compile('^\/')):
        a['href'] = base + a['href'][1:]

    for a in soup.find_all(src=re.compile('^\/')):
        if re.match(r'^\/images\/', a['src']):
            save_image(a['src'])
        a['src'] = base + a['src'][1:]

    for a in soup.find_all('script'):
        if re.search('GA_google|GS_google|gaJsHost|pageTracker', str(a.string)):
            a.extract()

    remove_element(soup, '.boxShare')
    remove_element(soup, '.pager')
    remove_element(soup, '#QRCode')
    for s in soup.find_all('script'):
        if s.has_attr('src') and re.search('scriptaculous', s['src']) is not None:
            s.extract()
            break


def get_user(user):
    headers = {'accept-language': 'ja'}
    index_template = None
    page = 1
    all_unit_codes = []
    while True:
        response = requests.get('http://wonderfl.net/user/%s/codes?page=%d' % (user, page), headers=headers)
        if index_template is None:
            index_template = response.text
        soup = BeautifulSoup(response.text, 'lxml')
        codes = soup.select('.unitCode')
        if len(codes) is 0:
            break
        all_unit_codes.extend(codes)
        page = page + 1
        # break

    urls = [x.select_one('.ttl a')['href'] for x in all_unit_codes]

    soup = BeautifulSoup(index_template, 'lxml')

    group = soup.select_one('.unitCodeGroup')
    group.clear()
    for x in all_unit_codes:
        group.append(x)

    rewrite_abs_urls(soup, '../../../')

    mkdir_p('wonderfl.net/user/%s/codes' % user)
    with open('wonderfl.net/user/%s/codes/index.html' % user, 'w') as f:
        raw = soup.prettify()
        raw = raw.replace('http://swf.wonderfl.net/', '../../')
        raw = re.sub(r'\?\d{10}', '', raw)
        raw = raw.replace('"/swf/WonderflViewer', '"../../swf/WonderflViewer')
        try:
            f.write(raw)
        except UnicodeEncodeError:
            f.write(raw.encode('utf-8'))

    return urls


def get_code_page(url):
    m = re.match('^http:\/\/wonderfl\.net\/c\/([0-9a-zA-Z]{4}).*$', url)
    if m is None:

        return
    id = m.group(1)
    mkdir_p('wonderfl.net/c/%s' % id)

    response = requests.get(url, headers={'accept-language': 'ja'})

    soup = BeautifulSoup(response.text, 'lxml')
    swf_url = soup.find(content=re.compile('http:\/\/swf\.wonderfl\.net\/swf'))['content']
    swf_path = swf_url[24:]
    swf_dir = os.path.dirname(swf_path)
    swf_file = os.path.basename(swf_path)
    mkdir_p('wonderfl.net/%s' % swf_dir)
    download_file(swf_url, 'wonderfl.net/%s/%s' % (swf_dir, swf_file))

    dl_link = soup.find(href=re.compile(r'download$'))
    dl_link['href'] = re.sub(r'download$', '%s.zip' % id, dl_link['href'])
    download_file('http://wonderfl.net/c/%s/download' % id, 'wonderfl.net/c/%s/%s.zip' % (id, id))

    rewrite_abs_urls(soup, '../../')

    with open('wonderfl.net/c/%s/index.html' % id, 'w') as f:
        raw = soup.prettify()
        raw = raw.replace('http://swf.wonderfl.net/', '../../')
        raw = re.sub(r'\?\d{10}', '', raw)
        raw = raw.replace('"/swf/WonderflViewer', '"../../swf/WonderflViewer')
        try:
            f.write(raw)
        except UnicodeEncodeError:
           -f.write(raw.encode('utf-8'))


if __name__ == '__main__':
    code_pages = get_user('Saqoosha')
    for p in code_pages:
        print(p)
        get_code_page(p)
        time.sleep(1)
    # get_code_page('http://wonderfl.net/c/rolo')
