import { html, css, LitElement, unsafeCSS } from 'lit';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { property } from 'lit/decorators.js';
import { ActionButton } from './action-button.js';
import { NewBook } from './new-book.js';
import { BookViewer } from './book-viewer.js';
import { Book } from './book.js';
import bg from './bg.jpg';


export default class Bookshelf extends ScopedElementsMixin(LitElement) {

    static get scopedElements() {
        return {
            'x-book': BookViewer,
            'new-book': NewBook,
            'action-button': ActionButton,
        };
    };

    static styles = css`
    :host {
        display: flex;
        flex-wrap: wrap;
        background: #552a0a;
        background-image: url('${unsafeCSS(bg)}');
        border: 8px solid rgb(119 63 21);
        box-shadow: rgb(0 0 0) 0px 0px 25px -4px inset;
        align-items: flex-end;
    }
    :host > div, new-book {
        border-bottom: 8px solid rgb(119 63 21);
        min-height: 180px;
        display: flex;
        align-items: flex-end;
    }
    :host > div {
        flex: 1;
        justify-content: center;
    }
     .filter {
            margin-bottom: 20px;
        }
    .filter select {
        padding: 5px;
        font-size: 16px;
    }
    .filter-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
        width: 100%;
        justify-content: center;
    }

    .filter-buttons action-button {
        margin: 5px;
    }

    .filter-buttons .active {
        background-color: #007bff;
        color: white;
    }  
  `;
    @property({ type: Array }) private _booksData: Book[] = [];
    @property({ type: Array }) private _filteredBooks: Book[] = [];
    @property({ type: String }) private _selectedCategory: string = 'All';
    @property() src: string = "";

    @property() editable: boolean = false;

    @property() private _editingEnabled: boolean = false;

    resolve(path: string) {
        const base = new URL(this.src, window.location.href).href;
        return new URL(path, base).href;
    }

    async firstUpdated() {
        const getDate = (book:Book) => {
            for (const key of ["dateRead", "dateAdded", "yearPublished"] as Array<keyof Book>) {
                if (book[key]) {
                    return new Date(book[key]);
                }
            }
            return new Date('1970');
        }
        this._editingEnabled = await this.checkEditingFeature();
        this._booksData = await this.loadBooks();
        this._filteredBooks = this._booksData; // Initialize filtered books with all books
        const response = await fetch(this.src);
        let booksJson: Book[] = await response.json();
        booksJson = booksJson.map((book) => ({
            ...book,
            cover: this.resolve(book.cover),
            fullSizeCover: this.resolve(book.fullSizeCover),
        }));
        this._booksData = booksJson.sort((bookA, bookB) => getDate(bookB).getTime() - getDate(bookA).getTime());
    }


    async checkEditingFeature() {
        if (!this.editable) {
            return false;
        }

        const response = await fetch('api');
        return response.status >= 200  && response.status < 300;
    }
    filterBooksByCategory(category: string) {
        this._selectedCategory = category;
        if (category === 'All') {
            this._filteredBooks = this._booksData;
        } else {
            this._filteredBooks = this._booksData.filter(book => (book.category || 'Uncategorized') === category);
        }
        this.requestUpdate();
    }
    get categories() {
        return ['All', ...new Set(this._booksData.map(book => book.category || 'Uncategorized'))];
    }
    deleteBook = async (book:Book):Promise<boolean> => {
        const newData = this._booksData.filter(bookT => bookT.id !== book.id);
        const response = await fetch(`api/book/${book.id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(book)
        });

        if (response.status >= 200 && response.status < 300) {
            this._booksData = newData;
            return true;
        } 
        return false;
    }

    updateBook = async (book:Book):Promise<boolean> => {
        let newData: Book[];
        let response: Response;

        if (book.id !== "") {
            newData = this._booksData.map(bookT => bookT.id === book.id ? book : bookT);
            response = await fetch(`api/book/${book.id}`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(book)
            });
        } else {
            newData = [...this._booksData];
            book.id = crypto.randomUUID();
            book.dateAdded = new Date().toISOString();
            newData.unshift(book);

            response = await fetch(`api/book/`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(book)
            });
        }

        if (response.status >= 200 && response.status < 300) {
            this._booksData = newData;
            return true;
        } 
        return false;
    }

    private async loadBooks(): Promise<Book[]> {
        const response = await fetch(this.src);
        return await response.json();
    }

    render() {
        return html`
            <div class="filter-buttons">
                ${this.categories.map(category => html`
                    <action-button 
                        @click=${() => this.filterBooksByCategory(category)}
                        class=${this._selectedCategory === category ? 'active' : ''}
                    >
                        ${category}
                    </action-button>
                `)}
            </div>
            <div class="books">
                ${this._filteredBooks.map(book => html`
                    <x-book .book=${book} .updateBook=${this.updateBook} .deleteBook=${this.deleteBook}></x-book>
                `)}
            </div>
            <new-book .updateBook=${this.updateBook}></new-book>
        `;
    }
}
