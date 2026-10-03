(function () {
    'use strict';

    function loadCatalog() {
        return fetch('catalogo/catalogo.json?v=' + Math.floor(Date.now() / 60000))
            .then(function (response) {
                if (!response.ok) throw new Error('catalogo ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (!data || !Array.isArray(data.categorias)) throw new Error('catalogo inválido');
                return data;
            })
            .catch(function () { return { categorias: [] }; });
    }

    function whenReady(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
    }

    whenReady(function () { loadCatalog().then(start); });

    function start(catalog) {

        var CONTATO = {
            whatsapp: '5581988898108',
            whatsappTexto: '(81) 9 8889-8108',
            instagram: 'BrownieOneMore'
        };

        var products = {};
        var bag = loadBag();

        catalog.categorias.forEach(function (category) {
            category.produtos.forEach(function (p) {
                p.categoria = category.nome;
                products[p.id] = p;
            });
        });

        Object.keys(bag).forEach(function (id) { if (!products[id]) delete bag[id]; });

        function money(cents) {
            return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }

        function el(tag, attrs, children) {
            var node = document.createElement(tag);
            Object.keys(attrs || {}).forEach(function (key) {
                if (key === 'text') node.textContent = attrs[key];
                else if (key === 'class') node.className = attrs[key];
                else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2), attrs[key]);
                else if (attrs[key] !== false && attrs[key] != null) node.setAttribute(key, attrs[key] === true ? '' : attrs[key]);
            });
            (children || []).forEach(function (child) {
                if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
            });
            return node;
        }

        function icon(name) {
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'icon');
            svg.setAttribute('aria-hidden', 'true');
            var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#i-' + name);
            svg.appendChild(use);
            return svg;
        }

        function summary(text) {
            return (text || '').split(/\n\s*\n/)[0].replace(/\s*\n\s*/g, ' ');
        }

        var SEM_FOTO = 'img/sem-foto.svg';

        function photo(p) {
            var cover = p.fotos && p.fotos[0];
            return cover ? cover.mini || cover.src : SEM_FOTO;
        }

        function loadBag() {
            try { return JSON.parse(localStorage.getItem('bom-sacola')) || {}; } catch (e) { return {}; }
        }

        function saveBag() {
            try { localStorage.setItem('bom-sacola', JSON.stringify(bag)); } catch (e) {  }
        }

        function setQty(id, qty) {
            qty = Math.max(0, Math.min(99, qty));
            if (qty) bag[id] = qty; else delete bag[id];
            saveBag();
            refreshControls(id);
            renderBag();
        }

        function bagCount() {
            return Object.keys(bag).reduce(function (sum, id) { return sum + bag[id]; }, 0);
        }

        function bagTotal() {
            return Object.keys(bag).reduce(function (sum, id) { return sum + bag[id] * products[id].preco; }, 0);
        }

        function control(p) {
            var box = el('div', { 'data-qty-for': p.id });
            fillControl(box, p);
            return box;
        }

        function fillControl(box, p) {
            box.textContent = '';
            var qty = bag[p.id] || 0;
            if (!qty) {
                box.appendChild(el('button', {
                    class: 'add', type: 'button', 'aria-label': 'Adicionar ' + p.nome + ' à sacola',
                    onclick: function () { setQty(p.id, 1); toast(p.nome + ' na sacola'); bump(); }
                }, [icon('plus'), 'Adicionar']));
                return;
            }
            box.appendChild(el('div', { class: 'qty', role: 'group', 'aria-label': 'Quantidade de ' + p.nome }, [
                el('button', { type: 'button', 'aria-label': 'Menos um', onclick: function () { setQty(p.id, qty - 1); } }, [icon('minus')]),
                el('output', { text: String(qty), 'aria-live': 'polite' }),
                el('button', { type: 'button', 'aria-label': 'Mais um', onclick: function () { setQty(p.id, qty + 1); bump(); } }, [icon('plus')])
            ]));
        }

        function refreshControls(id) {
            document.querySelectorAll('[data-qty-for="' + id + '"]').forEach(function (box) { fillControl(box, products[id]); });
        }

        var menu = document.querySelector('[data-menu]');
        var filters = document.querySelector('[data-menu-filters]');

        function renderMenu() {
            menu.textContent = '';
            if (!catalog.categorias.length) {
                menu.appendChild(el('p', { class: 'menu__empty', text: 'O cardápio está sendo atualizado. Chame a gente no WhatsApp para saber o que tem hoje!' }));
                return;
            }
            var several = catalog.categorias.length > 1;
            catalog.categorias.forEach(function (category, i) {
                var grid = el('div', { class: 'menu-grid' }, category.produtos.map(card));
                menu.appendChild(el('section', { class: 'menu-group', 'data-group': String(i) }, [
                    several ? el('h3', { class: 'menu-group__title', text: category.nome }) : null,
                    grid
                ]));
            });
            if (several) renderFilters();
        }

        function card(p) {
            var src = photo(p);
            var open = function () { openProduct(p.id); };
            return el('article', { class: 'product' }, [
                el('button', { class: 'product__photo', type: 'button', 'aria-label': 'Ver detalhes de ' + p.nome, onclick: open }, [
                    el('img', { src: src, alt: '', loading: 'lazy', width: '112', height: '112' })
                ]),
                el('div', { class: 'product__body' }, [
                    el('h3', {}, [el('button', { class: 'product__name', type: 'button', text: p.nome, onclick: open })]),
                    p.descricao ? el('p', { class: 'product__desc', text: summary(p.descricao) }) : null,
                    el('div', { class: 'product__foot' }, [
                        el('span', { class: 'product__price', text: money(p.preco) }),
                        control(p)
                    ])
                ])
            ]);
        }

        function renderFilters() {
            var chips = [el('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': 'true', 'data-filter': 'all', text: 'Todos' })];
            catalog.categorias.forEach(function (category, i) {
                chips.push(el('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': 'false', 'data-filter': String(i), text: category.nome }));
            });
            chips.forEach(function (chip) {
                chip.addEventListener('click', function () {
                    var value = chip.getAttribute('data-filter');
                    chips.forEach(function (c) { c.setAttribute('aria-selected', c === chip ? 'true' : 'false'); });
                    menu.querySelectorAll('[data-group]').forEach(function (group) {
                        group.hidden = value !== 'all' && group.getAttribute('data-group') !== value;
                    });
                });
                filters.appendChild(chip);
            });
            filters.hidden = false;
        }

        var sheet = document.querySelector('[data-product]');
        var sheetBody = document.querySelector('[data-product-body]');

        function openProduct(id) {
            var p = products[id];
            sheetBody.textContent = '';
            sheetBody.appendChild(el('button', { class: 'icon-button sheet__close', type: 'button', 'aria-label': 'Fechar', onclick: function () { sheet.close(); } }, [icon('x')]));
            sheetBody.appendChild(gallery(p));

            var parts = [
                el('span', { class: 'sheet__category', text: p.categoria }),
                el('h2', { class: 'sheet__title', id: 'product-title', text: p.nome }),
                el('div', { class: 'sheet__buy' }, [el('span', { class: 'sheet__price', text: money(p.preco) }), control(p)]),
                p.descricao ? el('p', { class: 'sheet__desc', text: p.descricao }) : null
            ];
            if (p.ingredientes) {
                parts.push(el('details', {}, [el('summary', { text: 'Ingredientes' }), el('p', { text: p.ingredientes })]));
            }
            if (p.nutricional && p.nutricional.itens.length) {
                parts.push(el('details', {}, [
                    el('summary', { text: 'Tabela nutricional' }),
                    el('table', { class: 'nutrition' }, [
                        p.nutricional.porcao ? el('caption', { text: 'Porção de ' + p.nutricional.porcao }) : null,
                        el('tbody', {}, p.nutricional.itens.map(function (row) {
                            return el('tr', {}, [el('td', { text: row[0] }), el('td', { text: row[1] })]);
                        }))
                    ])
                ]));
            }
            sheetBody.appendChild(el('div', { class: 'sheet__content' }, parts));
            showDialog(sheet);
        }

        function gallery(p) {
            var box = el('div', { class: 'sheet__gallery' });
            if (!p.fotos.length) {
                box.appendChild(el('img', { class: 'sheet__no-photo', src: SEM_FOTO, alt: '' }));
                return box;
            }
            var track = el('div', { class: 'slides' }, p.fotos.map(function (f, i) {

                return el('img', { src: f.src, alt: f.descricao || p.nome + (p.fotos.length > 1 ? ', foto ' + (i + 1) : ''), loading: i ? 'lazy' : 'eager' });
            }));
            box.appendChild(track);
            if (p.fotos.length < 2) return box;

            var dots = el('div', { class: 'slides__dots', 'aria-hidden': 'true' }, p.fotos.map(function (f, i) {
                return el('span', { class: i ? '' : 'is-active' });
            }));
            var go = function (dir) { track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' }); };
            box.appendChild(el('button', { class: 'icon-button slides__nav slides__nav--prev', type: 'button', 'aria-label': 'Foto anterior', onclick: function () { go(-1); } }, [icon('chevron-left')]));
            box.appendChild(el('button', { class: 'icon-button slides__nav slides__nav--next', type: 'button', 'aria-label': 'Próxima foto', onclick: function () { go(1); } }, [icon('chevron-right')]));
            box.appendChild(dots);
            track.addEventListener('scroll', function () {
                var index = Math.round(track.scrollLeft / track.clientWidth);
                Array.prototype.forEach.call(dots.children, function (dot, i) { dot.classList.toggle('is-active', i === index); });
            }, { passive: true });
            return box;
        }

        var drawer = document.querySelector('[data-bag]');
        var list = document.querySelector('[data-bag-list]');
        var form = document.querySelector('[data-order-form]');

        function renderBag() {
            var ids = Object.keys(bag);
            var count = bagCount();
            var badge = document.querySelector('[data-bag-count]');
            badge.textContent = count;
            badge.hidden = !count;

            list.textContent = '';
            ids.forEach(function (id) {
                var p = products[id];
                var src = photo(p);
                list.appendChild(el('li', { class: 'bag-item' }, [
                    el('img', { class: 'bag-item__photo', src: src, alt: '' }),
                    el('div', {}, [el('div', { class: 'bag-item__name', text: p.nome }), el('div', { class: 'bag-item__price', text: money(p.preco) + ' cada' })]),
                    el('div', { class: 'bag-item__side' }, [el('span', { class: 'bag-item__total', text: money(p.preco * bag[id]) }), control(p)])
                ]));
            });
            document.querySelector('[data-bag-empty]').hidden = ids.length > 0;
            document.querySelector('[data-bag-foot]').hidden = !ids.length;
            form.hidden = !ids.length;
            document.querySelector('[data-bag-total]').textContent = money(bagTotal());
        }

        function orderMessage() {
            var data = new FormData(form);
            var lines = ['Olá! Quero fazer uma encomenda:', ''];
            Object.keys(bag).forEach(function (id) {
                lines.push(bag[id] + 'x ' + products[id].nome + ' — ' + money(products[id].preco * bag[id]));
            });
            lines.push('', '*Total: ' + money(bagTotal()) + '*');
            var name = String(data.get('nome') || '').trim();
            var phone = phoneDigits(String(data.get('telefone') || ''));
            var notes = String(data.get('obs') || '').trim();
            if (name) lines.push('Nome: ' + name);
            if (phone) lines.push('Telefone: ' + formatPhone(phone));
            if (notes) lines.push('Obs.: ' + notes);
            return lines.join('\n');
        }

        var phoneInput = form.querySelector('[name="telefone"]');
        var phoneError = document.querySelector('[data-phone-error]');
        var PHONE_HINT = 'Confira o telefone: DDD + número, ex.: (81) 98888-7777.';

        function phoneDigits(text) {
            var d = String(text).replace(/\D/g, '');
            if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) d = d.slice(2);
            return d.length === 10 || d.length === 11 ? d : '';
        }

        function formatPhone(d) {
            var cut = d.length === 11 ? 7 : 6;
            return '(' + d.slice(0, 2) + ') ' + d.slice(2, cut) + '-' + d.slice(cut);
        }

        function showPhoneError(text) {
            phoneInput.setAttribute('aria-invalid', text ? 'true' : 'false');
            phoneError.textContent = text;
            phoneError.hidden = !text;
        }

        phoneInput.addEventListener('input', function () { showPhoneError(''); });
        phoneInput.addEventListener('blur', function () {
            var typed = phoneInput.value.trim();
            if (!typed) return;
            var d = phoneDigits(typed);
            if (d) phoneInput.value = formatPhone(d); else showPhoneError(PHONE_HINT);
        });

        document.querySelector('[data-bag-send]').addEventListener('click', function () {
            var typed = phoneInput.value.trim();
            if (typed && !phoneDigits(typed)) {
                showPhoneError(PHONE_HINT);
                phoneInput.focus();
                return;
            }
            window.open('https://wa.me/' + CONTATO.whatsapp + '?text=' + encodeURIComponent(orderMessage()), '_blank', 'noopener');
        });

        document.querySelector('[data-bag-clear]').addEventListener('click', function () {
            if (!window.confirm('Limpar a sacola e começar outro pedido?')) return;
            var ids = Object.keys(bag);
            bag = {};
            saveBag();
            form.reset();
            showPhoneError('');
            ids.forEach(refreshControls);
            renderBag();
            toast('Sacola limpa');
        });
        document.querySelector('[data-bag-open]').addEventListener('click', function () { showDialog(drawer); });
        document.querySelector('[data-bag-close]').addEventListener('click', function () { drawer.close(); });

        function showDialog(dialog) {
            if (!dialog.open) dialog.showModal();
            document.body.classList.add('is-locked');
        }

        [drawer, sheet].forEach(function (dialog) {
            dialog.addEventListener('close', function () {
                if (!drawer.open && !sheet.open) document.body.classList.remove('is-locked');
            });

            dialog.addEventListener('click', function (event) {
                if (event.target === dialog) dialog.close();
            });
        });

        var toastEl = document.querySelector('[data-toast]');
        var toastTimer;
        function toast(text) {
            toastEl.textContent = text;
            toastEl.hidden = false;
            clearTimeout(toastTimer);
            toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
        }

        function bump() {
            var button = document.querySelector('[data-bag-open]');
            button.classList.remove('is-bumped');
            void button.offsetWidth;
            button.classList.add('is-bumped');
        }

        document.querySelectorAll('[data-whatsapp-link]').forEach(function (a) {
            a.href = 'https://wa.me/' + CONTATO.whatsapp;
            a.target = '_blank';
            a.rel = 'noopener';
        });
        document.querySelectorAll('[data-whatsapp-label]').forEach(function (s) { s.textContent = CONTATO.whatsappTexto; });
        document.querySelectorAll('[data-instagram-link]').forEach(function (a) { a.href = 'https://instagram.com/' + CONTATO.instagram; });
        document.querySelectorAll('[data-instagram-label]').forEach(function (s) { s.textContent = '@' + CONTATO.instagram; });
        document.querySelector('[data-year]').textContent = new Date().getFullYear();

        renderMenu();
        renderBag();
    }
})();
