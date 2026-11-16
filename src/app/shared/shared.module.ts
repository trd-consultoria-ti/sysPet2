import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { SectionHeadingComponent } from './components/section-heading/section-heading.component';
import { StarRatingComponent } from './components/star-rating/star-rating.component';
import { WishlistButtonComponent } from './components/wishlist-button/wishlist-button.component';
import { QuickViewModalComponent } from './components/quick-view-modal/quick-view-modal.component';
import { FilterPanelComponent } from './components/filter-panel/filter-panel.component';
import { LogoComponent } from './components/logo/logo.component';
import { NavActionsComponent } from './components/nav-actions/nav-actions.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { CategoryFilterComponent } from './components/category-filter/category-filter.component';
import { PriceSliderComponent } from './components/price-slider/price-slider.component';
import { RatingFilterComponent } from './components/rating-filter/rating-filter.component';
import { DurationFilterComponent } from './components/duration-filter/duration-filter.component';
import { ItemCardComponent } from './components/item-card/item-card.component';
import { ItemListComponent } from './components/item-list/item-list.component';
import { GlobalNavMenuComponent } from './components/global-nav-menu/global-nav-menu.component';

@NgModule({
  declarations: [
    NavbarComponent,
    FooterComponent,
    SectionHeadingComponent,
    StarRatingComponent,
    WishlistButtonComponent,
    QuickViewModalComponent,
    FilterPanelComponent,
    LogoComponent,
    NavActionsComponent,
    SearchBarComponent,
    CategoryFilterComponent,
    PriceSliderComponent,
    RatingFilterComponent,
    DurationFilterComponent,
    ItemCardComponent,
    ItemListComponent,
    GlobalNavMenuComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule
  ],
  exports: [
    NavbarComponent,
    FooterComponent,
    SectionHeadingComponent,
    StarRatingComponent,
    WishlistButtonComponent,
    QuickViewModalComponent,
    FilterPanelComponent,
    LogoComponent,
    NavActionsComponent,
    SearchBarComponent,
    CategoryFilterComponent,
    PriceSliderComponent,
    RatingFilterComponent,
    DurationFilterComponent,
    ItemCardComponent,
    ItemListComponent,
    GlobalNavMenuComponent,
    FormsModule
  ]
})
export class SharedModule { }