/**
 * @file
 * Table select functionality.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Initialize tableSelects.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches tableSelect functionality.
   */
  Drupal.behaviors.tableSelect = {
    attach: function (context, settings) {
      // Select the inner-most table in case of nested tables.
      $(context).find('th.select-all').closest('table').once('table-select').each(Drupal.tableSelect);
    }
  };

  /**
   * Callback used in {@link Drupal.behaviors.tableSelect}.
   */
  Drupal.tableSelect = function () {
    // Do not add a "Select all" checkbox if there are no rows with checkboxes
    // in the table.
    if ($(this).find('td input[type="checkbox"]').length === 0) {
      return;
    }

    // Keep track of the table, which checkbox is checked and alias the
    // settings.
    var table = this;
    var checkboxes;
    var lastChecked;
    var $table = $(table);
    var strings = {
      selectAll: Drupal.t('Select all rows in this table'),
      selectNone: Drupal.t('Deselect all rows in this table')
    };
    var updateSelectAll = function (state) {
      // Update table's select-all checkbox (and sticky header's if available).
      $table.prev('table.sticky-header').addBack().find('th.select-all input[type="checkbox"]').each(function () {
        var $checkbox = $(this);
        var stateChanged = $checkbox.prop('checked') !== state;

        $checkbox.attr('title', state ? strings.selectNone : strings.selectAll);

        /**
         * @checkbox {HTMLElement}
         */
        if (stateChanged) {
          $checkbox.prop('checked', state).trigger('change');
        }
      });
    };

    // Find all <th> with class select-all, and insert the check all checkbox.
    $table.find('th.select-all').prepend($('<input type="checkbox" class="form-checkbox" />').attr('title', strings.selectAll)).on('click', function (event) {
      if ($(event.target).is('input[type="checkbox"]')) {
        // Loop through all checkboxes and set their state to the select all
        // checkbox' state.
        checkboxes.each(function () {
          var $checkbox = $(this);
          var stateChanged = $checkbox.prop('checked') !== event.target.checked;

          /**
           * @checkbox {HTMLElement}
           */
          if (stateChanged) {
            $checkbox.prop('checked', event.target.checked).trigger('change');
          }
          // Either add or remove the selected class based on the state of the
          // check all checkbox.

          /**
           * @checkbox {HTMLElement}
           */
          $checkbox.closest('tr').toggleClass('selected', this.checked);
        });
        // Update the title and the state of the check all box.
        updateSelectAll(event.target.checked);
      }
    });

    // For each of the checkboxes within the table that are not disabled.
    checkboxes = $table.find('td input[type="checkbox"]:enabled').on('click', function (e) {
      // Either add or remove the selected class based on the state of the
      // check all checkbox.

      /**
       * @this {HTMLElement}
       */
      $(this).closest('tr').toggleClass('selected', this.checked);

      // If this is a shift click, we need to highlight everything in the
      // range. Also make sure that we are actually checking checkboxes
      // over a range and that a checkbox has been checked or unchecked before.
      if (e.shiftKey && lastChecked && lastChecked !== e.target) {
        // We use the checkbox's parent <tr> to do our range searching.
        Drupal.tableSelectRange($(e.target).closest('tr')[0], $(lastChecked).closest('tr')[0], e.target.checked);
      }

      // If all checkboxes are checked, make sure the select-all one is checked
      // too, otherwise keep unchecked.
      updateSelectAll((checkboxes.length === checkboxes.filter(':checked').length));

      // Keep track of the last checked checkbox.
      lastChecked = e.target;
    });

    // If all checkboxes are checked on page load, make sure the select-all one
    // is checked too, otherwise keep unchecked.
    updateSelectAll((checkboxes.length === checkboxes.filter(':checked').length));
  };

  /**
   * @param {HTMLElement} from
   *   The HTML element representing the "from" part of the range.
   * @param {HTMLElement} to
   *   The HTML element representing the "to" part of the range.
   * @param {bool} state
   *   The state to set on the range.
   */
  Drupal.tableSelectRange = function (from, to, state) {
    // We determine the looping mode based on the order of from and to.
    var mode = from.rowIndex > to.rowIndex ? 'previousSibling' : 'nextSibling';

    // Traverse through the sibling nodes.
    for (var i = from[mode]; i; i = i[mode]) {
      var $i;
      // Make sure that we're only dealing with elements.
      if (i.nodeType !== 1) {
        continue;
      }
      $i = $(i);
      // Either add or remove the selected class based on the state of the
      // target checkbox.
      $i.toggleClass('selected', state);
      $i.find('input[type="checkbox"]').prop('checked', state);

      if (to.nodeType) {
        // If we are at the end of the range, stop.
        if (i === to) {
          break;
        }
      }
      // A faster alternative to doing $(i).filter(to).length.
      else if ($.filter(to, [i]).r.length) {
        break;
      }
    }
  };

})(jQuery, Drupal);
;
/**
 * @file
 * Select-All Button functionality.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.views_bulk_operations = {
    attach: function (context, settings) {
      $('.vbo-select-all').closest('.view-content').once('select-all').each(Drupal.selectAll);
    }
  };

  /**
   * Callback used in {@link Drupal.behaviors.views_bulk_operations}.
   */
  Drupal.selectAll = function () {
    var $viewContent = $(this);
    var $viewsTable = $('table.views-table', $viewContent);
    var colspan = $('table.views-table > thead th', $viewContent).length;
    var $primarySelectAll = $('.vbo-select-all', $viewContent);
    var $tableSelectAll = $(this).find('.select-all input').first();
    $primarySelectAll.parent().hide();

    var strings = {
      selectAll: $('label', $primarySelectAll.parent()).html(),
      selectRegular: Drupal.t('Select only items on this page')
    };

    // Initialize all selector.
    var $allSelector;
    $allSelector = $('<tr class="views-table-row-vbo-select-all even" style="display: none"><td colspan="' + colspan + '"><div><input type="submit" class="form-submit" value="' + strings.selectAll + '"></div></td></tr>');
    $('tbody', $viewsTable).prepend($allSelector);

    if ($primarySelectAll.is(':checked')) {
      $('input', $allSelector).val(strings.selectRegular);
      $allSelector.show();
    }
    else if ($tableSelectAll.is(':checked')) {
      $allSelector.show();
    }

    $('input', $allSelector).click(function (event) {
      event.preventDefault();
      if ($primarySelectAll.is(':checked')) {
        $primarySelectAll.prop('checked', false);
        $allSelector.removeClass('all-selected');
        $(this).val(strings.selectAll);
      }
      else {
        $primarySelectAll.prop('checked', true);
        $allSelector.addClass('all-selected');
        $(this).val(strings.selectRegular);
      }
    });

    $tableSelectAll.change(function (event) {
      if (this.checked) {
        $allSelector.show();
      }
      else {
        $allSelector.hide();
        if ($primarySelectAll.is(':checked')) {
          $('input', $allSelector).trigger('click');
        }
      }

    });
  };
})(jQuery, Drupal);
;
