import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ItemType } from '../item-card/item-card.component';

@Component({
  selector: 'app-item-list',
  templateUrl: './item-list.component.html',
  styleUrls: ['./item-list.component.scss']
})
export class ItemListComponent {
  @Input() items: any[] = [];
  @Input() type?: ItemType;

  @Output() itemAction = new EventEmitter<any>();

  trackByItemId(index: number, item: any): number | string {
    return item ? item.id : index;
  }
}
