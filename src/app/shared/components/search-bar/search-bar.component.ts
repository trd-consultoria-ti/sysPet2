import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent implements OnInit, OnDestroy {
  @Input() placeholder: string = 'Buscar...';
  @Input() label: string = 'Buscar';
  @Input() inputId: string = 'search-input';
  @Input() value: string = '';
  @Input() debounceTimeMs: number = 300;

  @Output() search = new EventEmitter<string>();
  @Output() valueChange = new EventEmitter<string>();

  private searchSubject = new Subject<string>();
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.searchSubject.pipe(
      debounceTime(this.debounceTimeMs),
      distinctUntilChanged()
    ).subscribe(val => {
      this.search.emit(val);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value = val;
    this.valueChange.emit(val);
    this.searchSubject.next(val);
  }

  clear(): void {
    this.value = '';
    this.valueChange.emit('');
    this.search.emit('');
  }
}
