/**
 * @file
 * Dialog API inspired by HTML5 dialog element.
 *
 * @see http://www.whatwg.org/specs/web-apps/current-work/multipage/commands.html#the-dialog-element
 */

(function ($, Drupal, drupalSettings) {

  'use strict';

  /**
   * Default dialog options.
   *
   * @type {object}
   *
   * @prop {bool} [autoOpen=true]
   * @prop {string} [dialogClass='']
   * @prop {string} [buttonClass='button']
   * @prop {string} [buttonPrimaryClass='button--primary']
   * @prop {function} close
   */
  drupalSettings.dialog = {
    autoOpen: true,
    dialogClass: '',
    // Drupal-specific extensions: see dialog.jquery-ui.js.
    buttonClass: 'button',
    buttonPrimaryClass: 'button--primary',
    // When using this API directly (when generating dialogs on the client
    // side), you may want to override this method and do
    // `jQuery(event.target).remove()` as well, to remove the dialog on
    // closing.
    close: function (event) {
      Drupal.dialog(event.target).close();
      Drupal.detachBehaviors(event.target, null, 'unload');
    }
  };

  /**
   * @typedef {object} Drupal.dialog~dialogDefinition
   *
   * @prop {boolean} open
   *   Is the dialog open or not.
   * @prop {*} returnValue
   *   Return value of the dialog.
   * @prop {function} show
   *   Method to display the dialog on the page.
   * @prop {function} showModal
   *   Method to display the dialog as a modal on the page.
   * @prop {function} close
   *   Method to hide the dialog from the page.
   */

  /**
   * Polyfill HTML5 dialog element with jQueryUI.
   *
   * @param {HTMLElement} element
   *   The element that holds the dialog.
   * @param {object} options
   *   jQuery UI options to be passed to the dialog.
   *
   * @return {Drupal.dialog~dialogDefinition}
   *   The dialog instance.
   */
  Drupal.dialog = function (element, options) {
    var undef;
    var $element = $(element);
    var dialog = {
      open: false,
      returnValue: undef,
      show: function () {
        openDialog({modal: false});
      },
      showModal: function () {
        openDialog({modal: true});
      },
      close: closeDialog
    };

    function openDialog(settings) {
      settings = $.extend({}, drupalSettings.dialog, options, settings);
      // Trigger a global event to allow scripts to bind events to the dialog.
      $(window).trigger('dialog:beforecreate', [dialog, $element, settings]);
      $element.dialog(settings);
      dialog.open = true;
      $(window).trigger('dialog:aftercreate', [dialog, $element, settings]);
    }

    function closeDialog(value) {
      $(window).trigger('dialog:beforeclose', [dialog, $element]);
      $element.dialog('close');
      dialog.returnValue = value;
      dialog.open = false;
      $(window).trigger('dialog:afterclose', [dialog, $element]);
    }

    return dialog;
  };

})(jQuery, Drupal, drupalSettings);
;
/**
 * @file
 * Positioning extensions for dialogs.
 */

/**
 * Triggers when content inside a dialog changes.
 *
 * @event dialogContentResize
 */

(function ($, Drupal, drupalSettings, debounce, displace) {

  'use strict';

  // autoResize option will turn off resizable and draggable.
  drupalSettings.dialog = $.extend({autoResize: true, maxHeight: '95%'}, drupalSettings.dialog);

  /**
   * Resets the current options for positioning.
   *
   * This is used as a window resize and scroll callback to reposition the
   * jQuery UI dialog. Although not a built-in jQuery UI option, this can
   * be disabled by setting autoResize: false in the options array when creating
   * a new {@link Drupal.dialog}.
   *
   * @function Drupal.dialog~resetSize
   *
   * @param {jQuery.Event} event
   *   The event triggered.
   *
   * @fires event:dialogContentResize
   */
  function resetSize(event) {
    var positionOptions = ['width', 'height', 'minWidth', 'minHeight', 'maxHeight', 'maxWidth', 'position'];
    var adjustedOptions = {};
    var windowHeight = $(window).height();
    var option;
    var optionValue;
    var adjustedValue;
    for (var n = 0; n < positionOptions.length; n++) {
      option = positionOptions[n];
      optionValue = event.data.settings[option];
      if (optionValue) {
        // jQuery UI does not support percentages on heights, convert to pixels.
        if (typeof optionValue === 'string' && /%$/.test(optionValue) && /height/i.test(option)) {
          // Take offsets in account.
          windowHeight -= displace.offsets.top + displace.offsets.bottom;
          adjustedValue = parseInt(0.01 * parseInt(optionValue, 10) * windowHeight, 10);
          // Don't force the dialog to be bigger vertically than needed.
          if (option === 'height' && event.data.$element.parent().outerHeight() < adjustedValue) {
            adjustedValue = 'auto';
          }
          adjustedOptions[option] = adjustedValue;
        }
      }
    }
    // Offset the dialog center to be at the center of Drupal.displace.offsets.
    if (!event.data.settings.modal) {
      adjustedOptions = resetPosition(adjustedOptions);
    }
    event.data.$element
      .dialog('option', adjustedOptions)
      .trigger('dialogContentResize');
  }

  /**
   * Position the dialog's center at the center of displace.offsets boundaries.
   *
   * @function Drupal.dialog~resetPosition
   *
   * @param {object} options
   *   Options object.
   *
   * @return {object}
   *   Altered options object.
   */
  function resetPosition(options) {
    var offsets = displace.offsets;
    var left = offsets.left - offsets.right;
    var top = offsets.top - offsets.bottom;

    var leftString = (left > 0 ? '+' : '-') + Math.abs(Math.round(left / 2)) + 'px';
    var topString = (top > 0 ? '+' : '-') + Math.abs(Math.round(top / 2)) + 'px';
    options.position = {
      my: 'center' + (left !== 0 ? leftString : '') + ' center' + (top !== 0 ? topString : ''),
      of: window
    };
    return options;
  }

  $(window).on({
    'dialog:aftercreate': function (event, dialog, $element, settings) {
      var autoResize = debounce(resetSize, 20);
      var eventData = {settings: settings, $element: $element};
      if (settings.autoResize === true || settings.autoResize === 'true') {
        $element
          .dialog('option', {resizable: false, draggable: false})
          .dialog('widget').css('position', 'fixed');
        $(window)
          .on('resize.dialogResize scroll.dialogResize', eventData, autoResize)
          .trigger('resize.dialogResize');
        $(document).on('drupalViewportOffsetChange.dialogResize', eventData, autoResize);
      }
    },
    'dialog:beforeclose': function (event, dialog, $element) {
      $(window).off('.dialogResize');
      $(document).off('.dialogResize');
    }
  });

})(jQuery, Drupal, drupalSettings, Drupal.debounce, Drupal.displace);
;
/**
 * @file
 * Adds default classes to buttons for styling purposes.
 */

(function ($) {

  'use strict';

  $.widget('ui.dialog', $.ui.dialog, {
    options: {
      buttonClass: 'button',
      buttonPrimaryClass: 'button--primary'
    },
    _createButtons: function () {
      var opts = this.options;
      var primaryIndex;
      var $buttons;
      var index;
      var il = opts.buttons.length;
      for (index = 0; index < il; index++) {
        if (opts.buttons[index].primary && opts.buttons[index].primary === true) {
          primaryIndex = index;
          delete opts.buttons[index].primary;
          break;
        }
      }
      this._super();
      $buttons = this.uiButtonSet.children().addClass(opts.buttonClass);
      if (typeof primaryIndex !== 'undefined') {
        $buttons.eq(index).addClass(opts.buttonPrimaryClass);
      }
    }
  });

})(jQuery);
;
/**
 * @file
 * Extends the Drupal AJAX functionality to integrate the dialog API.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Initialize dialogs for Ajax purposes.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behaviors for dialog ajax functionality.
   */
  Drupal.behaviors.dialog = {
    attach: function (context, settings) {
      var $context = $(context);

      // Provide a known 'drupal-modal' DOM element for Drupal-based modal
      // dialogs. Non-modal dialogs are responsible for creating their own
      // elements, since there can be multiple non-modal dialogs at a time.
      if (!$('#drupal-modal').length) {
        // Add 'ui-front' jQuery UI class so jQuery UI widgets like autocomplete
        // sit on top of dialogs. For more information see
        // http://api.jqueryui.com/theming/stacking-elements/.
        $('<div id="drupal-modal" class="ui-front"/>').hide().appendTo('body');
      }

      // Special behaviors specific when attaching content within a dialog.
      // These behaviors usually fire after a validation error inside a dialog.
      var $dialog = $context.closest('.ui-dialog-content');
      if ($dialog.length) {
        // Remove and replace the dialog buttons with those from the new form.
        if ($dialog.dialog('option', 'drupalAutoButtons')) {
          // Trigger an event to detect/sync changes to buttons.
          $dialog.trigger('dialogButtonsChange');
        }

        // Force focus on the modal when the behavior is run.
        $dialog.dialog('widget').trigger('focus');
      }

      var originalClose = settings.dialog.close;
      // Overwrite the close method to remove the dialog on closing.
      settings.dialog.close = function (event) {
        originalClose.apply(settings.dialog, arguments);
        $(event.target).remove();
      };
    },

    /**
     * Scan a dialog for any primary buttons and move them to the button area.
     *
     * @param {jQuery} $dialog
     *   An jQuery object containing the element that is the dialog target.
     *
     * @return {Array}
     *   An array of buttons that need to be added to the button area.
     */
    prepareDialogButtons: function ($dialog) {
      var buttons = [];
      var $buttons = $dialog.find('.form-actions input[type=submit], .form-actions a.button');
      $buttons.each(function () {
        // Hidden form buttons need special attention. For browser consistency,
        // the button needs to be "visible" in order to have the enter key fire
        // the form submit event. So instead of a simple "hide" or
        // "display: none", we set its dimensions to zero.
        // See http://mattsnider.com/how-forms-submit-when-pressing-enter/
        var $originalButton = $(this).css({
          display: 'block',
          width: 0,
          height: 0,
          padding: 0,
          border: 0,
          overflow: 'hidden'
        });
        buttons.push({
          text: $originalButton.html() || $originalButton.attr('value'),
          class: $originalButton.attr('class'),
          click: function (e) {
            // If the original button is an anchor tag, triggering the "click"
            // event will not simulate a click. Use the click method instead.
            if ($originalButton.is('a')) {
              $originalButton[0].click();
            }
            else {
              $originalButton.trigger('mousedown').trigger('mouseup').trigger('click');
              e.preventDefault();
            }
          }
        });
      });
      return buttons;
    }
  };

  /**
   * Command to open a dialog.
   *
   * @param {Drupal.Ajax} ajax
   *   The Drupal Ajax object.
   * @param {object} response
   *   Object holding the server response.
   * @param {number} [status]
   *   The HTTP status code.
   *
   * @return {bool|undefined}
   *   Returns false if there was no selector property in the response object.
   */
  Drupal.AjaxCommands.prototype.openDialog = function (ajax, response, status) {
    if (!response.selector) {
      return false;
    }
    var $dialog = $(response.selector);
    if (!$dialog.length) {
      // Create the element if needed.
      $dialog = $('<div id="' + response.selector.replace(/^#/, '') + '" class="ui-front"/>').appendTo('body');
    }
    // Set up the wrapper, if there isn't one.
    if (!ajax.wrapper) {
      ajax.wrapper = $dialog.attr('id');
    }

    // Use the ajax.js insert command to populate the dialog contents.
    response.command = 'insert';
    response.method = 'html';
    ajax.commands.insert(ajax, response, status);

    // Move the buttons to the jQuery UI dialog buttons area.
    if (!response.dialogOptions.buttons) {
      response.dialogOptions.drupalAutoButtons = true;
      response.dialogOptions.buttons = Drupal.behaviors.dialog.prepareDialogButtons($dialog);
    }

    // Bind dialogButtonsChange.
    $dialog.on('dialogButtonsChange', function () {
      var buttons = Drupal.behaviors.dialog.prepareDialogButtons($dialog);
      $dialog.dialog('option', 'buttons', buttons);
    });

    // Open the dialog itself.
    response.dialogOptions = response.dialogOptions || {};
    var dialog = Drupal.dialog($dialog.get(0), response.dialogOptions);
    if (response.dialogOptions.modal) {
      dialog.showModal();
    }
    else {
      dialog.show();
    }

    // Add the standard Drupal class for buttons for style consistency.
    $dialog.parent().find('.ui-dialog-buttonset').addClass('form-actions');
  };

  /**
   * Command to close a dialog.
   *
   * If no selector is given, it defaults to trying to close the modal.
   *
   * @param {Drupal.Ajax} [ajax]
   *   The ajax object.
   * @param {object} response
   *   Object holding the server response.
   * @param {string} response.selector
   *   The selector of the dialog.
   * @param {bool} response.persist
   *   Whether to persist the dialog element or not.
   * @param {number} [status]
   *   The HTTP status code.
   */
  Drupal.AjaxCommands.prototype.closeDialog = function (ajax, response, status) {
    var $dialog = $(response.selector);
    if ($dialog.length) {
      Drupal.dialog($dialog.get(0)).close();
      if (!response.persist) {
        $dialog.remove();
      }
    }

    // Unbind dialogButtonsChange.
    $dialog.off('dialogButtonsChange');
  };

  /**
   * Command to set a dialog property.
   *
   * JQuery UI specific way of setting dialog options.
   *
   * @param {Drupal.Ajax} [ajax]
   *   The Drupal Ajax object.
   * @param {object} response
   *   Object holding the server response.
   * @param {string} response.selector
   *   Selector for the dialog element.
   * @param {string} response.optionsName
   *   Name of a key to set.
   * @param {string} response.optionValue
   *   Value to set.
   * @param {number} [status]
   *   The HTTP status code.
   */
  Drupal.AjaxCommands.prototype.setDialogOption = function (ajax, response, status) {
    var $dialog = $(response.selector);
    if ($dialog.length) {
      $dialog.dialog('option', response.optionName, response.optionValue);
    }
  };

  /**
   * Binds a listener on dialog creation to handle the cancel link.
   *
   * @param {jQuery.Event} e
   *   The event triggered.
   * @param {Drupal.dialog~dialogDefinition} dialog
   *   The dialog instance.
   * @param {jQuery} $element
   *   The jQuery collection of the dialog element.
   * @param {object} [settings]
   *   Dialog settings.
   */
  $(window).on('dialog:aftercreate', function (e, dialog, $element, settings) {
    $element.on('click.dialog', '.dialog-cancel', function (e) {
      dialog.close('cancel');
      e.preventDefault();
      e.stopPropagation();
    });
  });

  /**
   * Removes all 'dialog' listeners.
   *
   * @param {jQuery.Event} e
   *   The event triggered.
   * @param {Drupal.dialog~dialogDefinition} dialog
   *   The dialog instance.
   * @param {jQuery} $element
   *   jQuery collection of the dialog element.
   */
  $(window).on('dialog:beforeclose', function (e, dialog, $element) {
    $element.off('.dialog');
  });

})(jQuery, Drupal);
;
/**
 * @file
 * Enable CTRL+Enter to submit a form.
 */

(function ($) {

  'use strict';

  Drupal.behaviors.keycodeSubmit = {
    attach: function (context, settings) {

      // Enable CTRL+Enter to submit a form.
      var keySubmit = function (form, textarea, submit) {
        textarea.on("keydown", function (e) {
          // Make sure the textarea contains text.
          if ($.trim(textarea.val()) != "") {
            if ((e.keyCode == 13 && e.ctrlKey) || (e.keyCode == 13 && e.metaKey)){
              e.preventDefault();
              submit.prop('disabled', true);
              form.submit();
            }
          }
        });
      }

      // Post form.
      var postForm = $('#social-post-entity-form');
      keySubmit($(postForm), $('.form-textarea', postForm), $('.form-submit', postForm));

      // Comment forms.
      $('.comment-form').each(function () {
        keySubmit($(this), $('.form-textarea', this), $('.form-submit', this));
      });

    }
  };
})(jQuery);
;
// Generated by CoffeeScript 1.12.1
(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  (function($) {
    "use strict";
    var MentionsBase, MentionsContenteditable, MentionsInput, Selection, entityMap, escapeHtml, escapeRegExp, namespace;
    namespace = "mentionsInput";
    Selection = {
      get: function(input) {
        return {
          start: input[0].selectionStart,
          end: input[0].selectionEnd
        };
      },
      set: function(input, start, end) {
        if (end == null) {
          end = start;
        }
        if (input[0].selectionStart) {
          input[0].selectStart = start;
          return input[0].selectionEnd = end;
        }
      }
    };
    entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
      "/": "&#x2F;"
    };
    escapeHtml = function(text) {
      return text.replace(/[&<>"'\/]/g, function(s) {
        return entityMap[s];
      });
    };
    escapeRegExp = function(str) {
      var specials;
      specials = /[.*+?|()\[\]{}\\$^]/g;
      return str.replace(specials, "\\$&");
    };
    $.widget("ui.areacomplete", $.ui.autocomplete, {
      options: $.extend({}, $.ui.autocomplete.prototype.options, {
        matcher: "(\\b[^,]*)",
        suffix: ''
      }),
      _create: function() {
        this.overriden = {
          select: this.options.select,
          focus: this.options.focus
        };
        this.options.select = $.proxy(this.selectCallback, this);
        this.options.focus = $.proxy(this.focusCallback, this);
        $.ui.autocomplete.prototype._create.call(this);
        return this.matcher = new RegExp(this.options.matcher + '$');
      },
      selectCallback: function(event, ui) {
        var after, before, newval, value;
        value = this._value();
        before = value.substring(0, this.start);
        after = value.substring(this.end);
        newval = ui.item.value + this.options.suffix;
        value = before + newval + after;
        this._value(value);
        Selection.set(this.element, before.length + newval.length);
        if (this.overriden.select) {
          ui.item.pos = this.start;
          this.overriden.select(event, ui);
        }
        return false;
      },
      focusCallback: function() {
        if (this.overriden.focus) {
          return this.overriden.focus(event, ui);
        }
        return false;
      },
      search: function(value, event) {
        var match, pos, whitespace;
        if (!value) {
          value = this._value();
          pos = Selection.get(this.element).start;
          value = value.substring(0, pos);
          match = this.matcher.exec(value);
          if (!match) {
            return '';
          }
          whitespace = /^\s/.exec(match[0]);
          if (whitespace && whitespace[0]) {
            match.index++;
          }
          this.start = match.index;
          this.end = match.index + match[0].length;
          this.searchTerm = match[1];
        }
        return $.ui.autocomplete.prototype.search.call(this, this.searchTerm, event);
      },
      _renderItem: function(ul, item) {
        var anchor, li, regexp, value;
        if (typeof this.options.renderItem === 'function') {
          return this.options.renderItem(ul, item);
        }
        li = $('<li>');
        anchor = $('<a>').appendTo(li);
        if (item.image) {
          anchor.append("<img src=\"" + item.image + "\" />");
        }
        regexp = new RegExp("(" + escapeRegExp(this.searchTerm) + ")", "gi");
        value = item.value.replace(regexp, "<strong>$&</strong>");
        anchor.append(value);
        return li.appendTo(ul);
      }
    });
    $.widget("ui.editablecomplete", $.ui.areacomplete, {
      options: $.extend({}, $.ui.areacomplete.prototype.options, {
        showAtCaret: false
      }),
      selectCallback: function(event, ui) {
        var mention, pos;
        pos = {
          start: this.start,
          end: this.end
        };
        if (this.overriden.select) {
          ui.item.pos = pos;
          if (this.overriden.select(event, ui) === false) {
            return false;
          }
        }
        mention = document.createTextNode(ui.item.value);
        insertMention(mention, pos, this.options.suffix);
        this.element.change();
        return false;
      },
      search: function(value, event) {
        var match, node, pos, sel;
        if (!value) {
          sel = window.getSelection();
          node = sel.focusNode;
          value = node.textContent;
          pos = sel.focusOffset;
          value = value.substring(0, pos);
          match = this.matcher.exec(value);
          if (!match) {
            return '';
          }
          this.start = match.index;
          this.end = match.index + match[0].length;
          this._setDropdownPosition(node);
          this.searchTerm = match[1];
        }
        return $.ui.autocomplete.prototype.search.call(this, this.searchTerm, event);
      },
      _setDropdownPosition: function(node) {
        var boundary, posX, posY, rect;
        if (this.options.showAtCaret) {
          boundary = document.createRange();
          boundary.setStart(node, this.start);
          boundary.collapse(true);
          rect = boundary.getClientRects()[0];
          posX = rect.left + (window.scrollX || window.pageXOffset);
          posY = rect.top + rect.height + (window.scrollY || window.pageYOffset);
          this.options.position.of = document;
          return this.options.position.at = "left+" + posX + " top+" + posY;
        }
      }
    });
    MentionsBase = (function() {
      MentionsBase.prototype.marker = '\u200B';

      function MentionsBase(input1, options) {
        this.input = input1;
        this.options = $.extend({}, this.settings, options);
        if (!this.options.source) {
          this.options.source = this.input.data('source') || [];
        }
      }

      MentionsBase.prototype._getMatcher = function() {
        var allowedChars;
        allowedChars = '[^' + this.options.trigger + ']';
        return '(?:^|\\s)[' + this.options.trigger + '](' + allowedChars + '{0,20})';
      };

      MentionsBase.prototype._markupMention = function(mention) {
        return "@[" + mention.value + "](" + mention.uid + ")";
      };

      return MentionsBase;

    })();
    MentionsInput = (function(superClass) {
      var mimicProperties;

      extend(MentionsInput, superClass);

      mimicProperties = ['backgroundColor', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderTopWidth', 'borderLeftWidth', 'borderBottomWidth', 'borderRightWidth', 'fontSize', 'fontStyle', 'fontFamily', 'fontWeight', 'lineHeight', 'height', 'boxSizing'];

      function MentionsInput(input1, options) {
        var container;
        this.input = input1;
        this._updateHScroll = bind(this._updateHScroll, this);
        this._updateVScroll = bind(this._updateVScroll, this);
        this._updateValue = bind(this._updateValue, this);
        this._onSelect = bind(this._onSelect, this);
        this._addMention = bind(this._addMention, this);
        this._updateMentions = bind(this._updateMentions, this);
        this._update = bind(this._update, this);
        this.settings = {
          trigger: '@',
          widget: 'areacomplete',
          suffix: '',
          markup: this._markupMention,
          preview: true,
          autocomplete: {
            autoFocus: true,
            delay: 0
          }
        };
        MentionsInput.__super__.constructor.call(this, this.input, options);
        this.mentions = [];
        this.input.addClass('input');
        container = $('<div>', {
          'class': 'mentions-input'
        });
        container.css('display', this.input.css('display'));
        this.container = this.input.wrapAll(container).parent();
        this.hidden = this._createHidden();
        if (this.options.preview) {
          this.highlighter = this._createHighlighter();
          this.highlighterContent = $('div', this.highlighter);
          this.input.focus((function(_this) {
            return function() {
              return _this.highlighter.addClass('focus');
            };
          })(this)).blur((function(_this) {
            return function() {
              return _this.highlighter.removeClass('focus');
            };
          })(this));
        }
        options = $.extend({
          matcher: this._getMatcher(),
          select: this._onSelect,
          suffix: this.options.suffix,
          source: this.options.source,
          appendTo: this.input.parent()
        }, this.options.autocomplete);
        this.autocomplete = this.input[this.options.widget](options);
        this._setValue(this.input.val());
        this._initEvents();
      }

      MentionsInput.prototype._initEvents = function() {
        var tagName;
        this.input.on("input." + namespace + " change." + namespace, this._update);
        tagName = this.input.prop("tagName");
        if (tagName === "INPUT" && this.options.preview) {
          this.input.on("focus." + namespace, (function(_this) {
            return function() {
              return _this.interval = setInterval(_this._updateHScroll, 10);
            };
          })(this));
          return this.input.on("blur." + namespace, (function(_this) {
            return function() {
              setTimeout(_this._updateHScroll, 10);
              return clearInterval(_this.interval);
            };
          })(this));
        } else if (tagName === "TEXTAREA" && this.options.preview) {
          this.input.on("scroll." + namespace, ((function(_this) {
            return function() {
              return setTimeout(_this._updateVScroll, 10);
            };
          })(this)));
          return this.input.on("resize." + namespace, ((function(_this) {
            return function() {
              return setTimeout(_this._updateVScroll, 10);
            };
          })(this)));
        }
      };

      MentionsInput.prototype._setValue = function(value) {
        var match, mentionRE, offset;
        offset = 0;
        mentionRE = /@\[([^\]]+)\]\(([^ \)]+)\)/g;
        this.value = value.replace(mentionRE, '$1');
        this.input.val(this.value);
        match = mentionRE.exec(value);
        while (match) {
          this._addMention({
            name: match[1],
            uid: match[2],
            pos: match.index - offset
          });
          offset += match[2].length + 5;
          match = mentionRE.exec(value);
        }
        return this._updateValue();
      };

      MentionsInput.prototype._createHidden = function() {
        var hidden;
        hidden = $('<input>', {
          type: 'hidden',
          name: this.input.attr('name')
        });
        hidden.appendTo(this.container);
        this.input.removeAttr('name');
        return hidden;
      };

      MentionsInput.prototype._createHighlighter = function() {
        var content, highlighter, j, len, property;
        highlighter = $('<div>', {
          'class': 'highlighter'
        });
        if (this.input.prop("tagName") === "INPUT") {
          highlighter.css('whiteSpace', 'pre');
        } else {
          highlighter.css('whiteSpace', 'pre-wrap');
          highlighter.css('wordWrap', 'break-word');
        }
        content = $('<div>', {
          'class': 'highlighter-content'
        });
        highlighter.append(content).prependTo(this.container);
        for (j = 0, len = mimicProperties.length; j < len; j++) {
          property = mimicProperties[j];
          highlighter.css(property, this.input.css(property));
        }
        this.input.css('backgroundColor', 'transparent');
        return highlighter;
      };

      MentionsInput.prototype._update = function() {
        this._updateMentions();
        return this._updateValue();
      };

      MentionsInput.prototype._updateMentions = function() {
        var change, cursor, diff, i, j, k, len, mention, piece, ref, update_pos, value;
        value = this.input.val();
        diff = diffChars(this.value, value);
        update_pos = (function(_this) {
          return function(cursor, delta) {
            var j, len, mention, ref, results;
            ref = _this.mentions;
            results = [];
            for (j = 0, len = ref.length; j < len; j++) {
              mention = ref[j];
              if (mention.pos >= cursor) {
                results.push(mention.pos += delta);
              } else {
                results.push(void 0);
              }
            }
            return results;
          };
        })(this);
        cursor = 0;
        for (j = 0, len = diff.length; j < len; j++) {
          change = diff[j];
          if (change.added) {
            update_pos(cursor, change.count);
          } else if (change.removed) {
            update_pos(cursor, -change.count);
          }
          if (!change.removed) {
            cursor += change.count;
          }
        }
        ref = this.mentions.slice(0);
        for (i = k = ref.length - 1; k >= 0; i = k += -1) {
          mention = ref[i];
          piece = value.substring(mention.pos, mention.pos + mention.value.length);
          if (mention.value !== piece) {
            this.mentions.splice(i, 1);
          }
        }
        return this.value = value;
      };

      MentionsInput.prototype._addMention = function(mention) {
        this.mentions.push(mention);
        return this.mentions.sort(function(a, b) {
          return a.pos - b.pos;
        });
      };

      MentionsInput.prototype._onSelect = function(event, ui) {
        this._updateMentions();
        this._addMention(ui.item);
        return this._updateValue();
      };

      MentionsInput.prototype._updateValue = function() {
        var cursor, hdContent, hlContent, j, len, mention, piece, ref, value;
        value = this.input.val();
        hlContent = [];
        hdContent = [];
        cursor = 0;
        ref = this.mentions;
        for (j = 0, len = ref.length; j < len; j++) {
          mention = ref[j];
          piece = value.substring(cursor, mention.pos);
          hlContent.push(escapeHtml(piece));
          hdContent.push(piece);
          hlContent.push("<strong>" + mention.value + "</strong>");
          hdContent.push(this.options.markup(mention));
          cursor = mention.pos + mention.value.length;
        }
        piece = value.substring(cursor);
        if (this.options.preview) {
          this.highlighterContent.html(hlContent.join('') + escapeHtml(piece));
        }
        return this.hidden.val(hdContent.join('') + piece);
      };

      MentionsInput.prototype._updateVScroll = function() {
        var scrollTop;
        scrollTop = this.input.scrollTop();
        this.highlighterContent.css({
          top: "-" + scrollTop + "px"
        });
        return this.highlighter.height(this.input.height());
      };

      MentionsInput.prototype._updateHScroll = function() {
        var scrollLeft;
        scrollLeft = this.input.scrollLeft();
        return this.highlighterContent.css({
          left: "-" + scrollLeft + "px"
        });
      };

      MentionsInput.prototype._replaceWithSpaces = function(value, what) {
        return value.replace(what, Array(what.length).join(' '));
      };

      MentionsInput.prototype._cutChar = function(value, index) {
        return value.substring(0, index) + value.substring(index + 1);
      };

      MentionsInput.prototype.setValue = function() {
        var j, len, piece, pieces, value;
        pieces = 1 <= arguments.length ? slice.call(arguments, 0) : [];
        value = '';
        for (j = 0, len = pieces.length; j < len; j++) {
          piece = pieces[j];
          if (typeof piece === 'string') {
            value += piece;
          } else {
            value += this.options.markup(piece);
          }
        }
        return this._setValue(value);
      };

      MentionsInput.prototype.getValue = function() {
        return this.hidden.val();
      };

      MentionsInput.prototype.getRawValue = function() {
        return this.input.val().replace(this.marker, '');
      };

      MentionsInput.prototype.getMentions = function() {
        return this.mentions;
      };

      MentionsInput.prototype.clear = function() {
        this.input.val('');
        return this._update();
      };

      MentionsInput.prototype.destroy = function() {
        this.input.areacomplete("destroy");
        this.input.off("." + namespace).attr('name', this.hidden.attr('name'));
        return this.container.replaceWith(this.input);
      };

      return MentionsInput;

    })(MentionsBase);
    MentionsContenteditable = (function(superClass) {
      var insertMention, mentionTpl;

      extend(MentionsContenteditable, superClass);

      MentionsContenteditable.prototype.selector = '[data-mention]';

      function MentionsContenteditable(input1, options) {
        this.input = input1;
        this._onSelect = bind(this._onSelect, this);
        this._addMention = bind(this._addMention, this);
        this.settings = {
          trigger: '@',
          widget: 'editablecomplete',
          markup: this._markupMention,
          preview: true,
          autocomplete: {
            autoFocus: true,
            delay: 0
          }
        };
        MentionsContenteditable.__super__.constructor.call(this, this.input, options);
        options = $.extend({
          matcher: this._getMatcher(),
          suffix: this.marker,
          select: this._onSelect,
          source: this.options.source,
          showAtCaret: this.options.showAtCaret
        }, this.options.autocomplete);
        this.autocomplete = this.input[this.options.widget](options);
        this._setValue(this.input.html());
        this._initEvents();
      }

      mentionTpl = function(mention) {
        return "<strong data-mention=\"" + mention.uid + "\">" + mention.value + "</strong>";
      };

      insertMention = function(mention, pos, suffix) {
        var node, range, selection;
        selection = window.getSelection();
        node = selection.focusNode;
        range = selection.getRangeAt(0);
        range.setStart(node, pos.start);
        range.setEnd(node, pos.end);
        range.deleteContents();
        range.insertNode(mention);
        if (suffix) {
          suffix = document.createTextNode(suffix);
          $(suffix).insertAfter(mention);
          range.setStartAfter(suffix);
        } else {
          range.setStartAfter(mention);
        }
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return mention;
      };

      MentionsContenteditable.prototype._initEvents = function() {
        return this.input.find(this.selector).each((function(_this) {
          return function(i, el) {
            return _this._watch(el);
          };
        })(this));
      };

      MentionsContenteditable.prototype._setValue = function(value) {
        var mentionRE;
        mentionRE = /@\[([^\]]+)\]\(([^ \)]+)\)/g;
        value = value.replace(mentionRE, (function(_this) {
          return function(match, value, uid) {
            return mentionTpl({
              value: value,
              uid: uid
            }) + _this.marker;
          };
        })(this));
        return this.input.html(value);
      };

      MentionsContenteditable.prototype._addMention = function(data) {
        var mention, mentionNode;
        mentionNode = $(mentionTpl(data))[0];
        mention = insertMention(mentionNode, data.pos, this.marker);
        return this._watch(mention);
      };

      MentionsContenteditable.prototype._onSelect = function(event, ui) {
        this._addMention(ui.item);
        this.input.trigger("change." + namespace);
        return false;
      };

      MentionsContenteditable.prototype._watch = function(mention) {
        return mention.addEventListener('DOMCharacterDataModified', function(e) {
          var offset, range, sel, text;
          if (e.newValue !== e.prevValue) {
            text = e.target;
            sel = window.getSelection();
            offset = sel.focusOffset;
            $(text).insertBefore(mention);
            $(mention).remove();
            range = document.createRange();
            range.setStart(text, offset);
            range.collapse(true);
            sel.removeAllRanges();
            return sel.addRange(range);
          }
        });
      };

      MentionsContenteditable.prototype.update = function() {
        this._initValue();
        this._initEvents();
        return this.input.focus();
      };

      MentionsContenteditable.prototype.setValue = function() {
        var j, len, piece, pieces, value;
        pieces = 1 <= arguments.length ? slice.call(arguments, 0) : [];
        value = '';
        for (j = 0, len = pieces.length; j < len; j++) {
          piece = pieces[j];
          if (typeof piece === 'string') {
            value += piece;
          } else {
            value += this.options.markup(piece);
          }
        }
        this._setValue(value);
        this._initEvents();
        return this.input.focus();
      };

      MentionsContenteditable.prototype.getValue = function() {
        var markupMention, value;
        value = this.input.clone();
        markupMention = this.options.markup;
        $(this.selector, value).replaceWith(function() {
          var name, uid;
          uid = $(this).data('mention');
          name = $(this).text();
          return markupMention({
            name: name,
            uid: uid
          });
        });
        return value.html().replace(this.marker, '');
      };

      MentionsContenteditable.prototype.getMentions = function() {
        var mentions;
        mentions = [];
        $(this.selector, this.input).each(function() {
          return mentions.push({
            uid: $(this).data('mention'),
            name: $(this).text()
          });
        });
        return mentions;
      };

      MentionsContenteditable.prototype.clear = function() {
        return this.input.html('');
      };

      MentionsContenteditable.prototype.destroy = function() {
        this.input.editablecomplete("destroy");
        this.input.off("." + namespace);
        return this.input.html(this.getValue());
      };

      return MentionsContenteditable;

    })(MentionsBase);
    
    /*
     Copyright (c) 2009-2011, Kevin Decker <kpdecker@gmail.com>
     */
    function diffChars(oldString, newString) {
      // Handle the identity case (this is due to unrolling editLength == 0
      if (newString === oldString) {
        return [{ value: newString }];
      }
      if (!newString) {
        return [{ value: oldString, removed: true }];
      }
      if (!oldString) {
        return [{ value: newString, added: true }];
      }

      var newLen = newString.length, oldLen = oldString.length;
      var maxEditLength = newLen + oldLen;
      var bestPath = [{ newPos: -1, components: [] }];

      // Seed editLength = 0, i.e. the content starts with the same values
      var oldPos = extractCommon(bestPath[0], newString, oldString, 0);
      if (bestPath[0].newPos+1 >= newLen && oldPos+1 >= oldLen) {
        // Identity per the equality and tokenizer
        return [{value: newString}];
      }

      // Main worker method. checks all permutations of a given edit length for acceptance.
      function execEditLength() {
        for (var diagonalPath = -1*editLength; diagonalPath <= editLength; diagonalPath+=2) {
          var basePath;
          var addPath = bestPath[diagonalPath-1],
            removePath = bestPath[diagonalPath+1];
          oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
          if (addPath) {
            // No one else is going to attempt to use this value, clear it
            bestPath[diagonalPath-1] = undefined;
          }

          var canAdd = addPath && addPath.newPos+1 < newLen;
          var canRemove = removePath && 0 <= oldPos && oldPos < oldLen;
          if (!canAdd && !canRemove) {
            // If this path is a terminal then prune
            bestPath[diagonalPath] = undefined;
            continue;
          }

          // Select the diagonal that we want to branch from. We select the prior
          // path whose position in the new string is the farthest from the origin
          // and does not pass the bounds of the diff graph
          if (!canAdd || (canRemove && addPath.newPos < removePath.newPos)) {
            basePath = clonePath(removePath);
            pushComponent(basePath.components, undefined, true);
          } else {
            basePath = addPath;   // No need to clone, we've pulled it from the list
            basePath.newPos++;
            pushComponent(basePath.components, true, undefined);
          }

          var oldPos = extractCommon(basePath, newString, oldString, diagonalPath);

          // If we have hit the end of both strings, then we are done
          if (basePath.newPos+1 >= newLen && oldPos+1 >= oldLen) {
            return buildValues(basePath.components, newString, oldString);
          } else {
            // Otherwise track this path as a potential candidate and continue.
            bestPath[diagonalPath] = basePath;
          }
        }

        editLength++;
      }

      // Performs the length of edit iteration. Is a bit fugly as this has to support the
      // sync and async mode which is never fun. Loops over execEditLength until a value
      // is produced.
      var editLength = 1;
      while(editLength <= maxEditLength) {
        var ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }

    function buildValues(components, newString, oldString) {
      var componentPos = 0,
        componentLen = components.length,
        newPos = 0,
        oldPos = 0;

      for (; componentPos < componentLen; componentPos++) {
        var component = components[componentPos];
        if (!component.removed) {
          component.value = newString.slice(newPos, newPos + component.count);
          newPos += component.count;

          // Common case
          if (!component.added) {
            oldPos += component.count;
          }
        } else {
          component.value = oldString.slice(oldPos, oldPos + component.count);
          oldPos += component.count;
        }
      }

      return components;
    }

    function pushComponent(components, added, removed) {
      var last = components[components.length-1];
      if (last && last.added === added && last.removed === removed) {
        // We need to clone here as the component clone operation is just
        // as shallow array clone
        components[components.length-1] = {count: last.count + 1, added: added, removed: removed };
      } else {
        components.push({count: 1, added: added, removed: removed });
      }
    }

    function extractCommon(basePath, newString, oldString, diagonalPath) {
      var newLen = newString.length,
        oldLen = oldString.length,
        newPos = basePath.newPos,
        oldPos = newPos - diagonalPath,

        commonCount = 0;
      while (newPos+1 < newLen && oldPos+1 < oldLen && newString[newPos+1] == oldString[oldPos+1]) {
        newPos++;
        oldPos++;
        commonCount++;
      }

      if (commonCount) {
        basePath.components.push({count: commonCount});
      }

      basePath.newPos = newPos;
      return oldPos;
    }

    function clonePath(path) {
      return { newPos: path.newPos, components: path.components.slice(0) };
    };
    return $.fn[namespace] = function() {
      var args, options, returnValue;
      options = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      returnValue = this;
      this.each(function() {
        var instance, ref;
        if (typeof options === 'string' && options.charAt(0) !== '_') {
          instance = $(this).data('mentionsInput');
          if (options in instance) {
            return returnValue = instance[options].apply(instance, args);
          }
        } else {
          if ((ref = this.tagName) === 'INPUT' || ref === 'TEXTAREA') {
            return $(this).data('mentionsInput', new MentionsInput($(this), options));
          } else if (this.contentEditable === "true") {
            return $(this).data('mentionsInput', new MentionsContenteditable($(this), options));
          }
        }
      });
      return returnValue;
    };
  })(jQuery);

}).call(this);


;
/**
 * @file
 */

(function ($) {

  'use strict';

  /**
   * Behaviors.
   */
  Drupal.behaviors.socialMentions = {
    attach: function (context, settings) {
      $('.comment-form, #social-post-entity-form')
        .find('.form-textarea')
        .once('socialMentions').each(function (i, e) {
          $(e).mentionsInput({
            source: settings.path.baseUrl + 'mentions-autocomplete',
            showAtCaret: true,
            suffix: ' ',
            preview: false,
            autocomplete: {
              delay: 100,
              autofocus: false,
              renderItem: function($ul, item) {
                var $li = $('<li />'),
                    $a = $('<a class="mention__item" />').appendTo($li);

                $a.append(item.html_item);

                return $li.appendTo($ul);
              },
              open: function(event, ui) {
                var menu = $(this).data('ui-areacomplete').menu;
                menu.focus(null, $('li', menu.element).eq(0));
              }
            },
            markup: function(mention) {
              var type = settings.socialMentions.suggestionsFormat;

              if (type == 'full_name' || (type == 'all' && mention.profile_id)) {
                return settings.socialMentions.prefix + mention.profile_id + settings.socialMentions.suffix;
              }

              return settings.socialMentions.prefix + mention.username + settings.socialMentions.suffix;
            }
          });
      });
    }
  };

  Drupal.behaviors.socialMentionsReply = {
    attach: function (context, settings) {
      $('.comment-form')
        .once('socialMentionsReply')
        .each(function (i, e) {
          var form = e,
              $textarea = $('.form-textarea', form),
              mentionsInput = $textarea.data('mentionsInput');

          $('.mention-reply').on('click', function (e) {
            e.preventDefault();

            var author = $(this).data('author');

            if (author && !$textarea.val().length) {
              mentionsInput._updateMentions();
              mentionsInput._addMention({
                value: author.value,
                pos: $textarea.val().length,
                uid: author.uid,
                username: author.username,
                profile_id: author.profile_id,
                html_item: ''
              });
              mentionsInput.setValue($textarea.val() + author.value + ' ');
              mentionsInput._updateValue();
              $textarea.focus();

              if (this.hash.length) {
                var pid = this.hash.substr(1);

                $('.parent-comment', form).val(pid);
              }
            }

            return false;
          });

          $textarea.on('input', function () {
            if (!mentionsInput.mentions.length) {
              $('.parent-comment', form).val('');
            }
          });
        });
    }
  };

})(jQuery);
;
/**
 * @file
 * Attaches behavior for the Filter module.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Displays the guidelines of the selected text format automatically.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches behavior for updating filter guidelines.
   */
  Drupal.behaviors.filterGuidelines = {
    attach: function (context) {

      function updateFilterGuidelines(event) {
        var $this = $(event.target);
        var value = $this.val();
        $this.closest('.filter-wrapper')
          .find('.filter-guidelines-item').hide()
          .filter('.filter-guidelines-' + value).show();
      }

      $(context).find('.filter-guidelines').once('filter-guidelines')
        .find(':header').hide()
        .closest('.filter-wrapper').find('select.filter-list')
        .on('change.filterGuidelines', updateFilterGuidelines)
        // Need to trigger the namespaced event to avoid triggering formUpdated
        // when initializing the select.
        .trigger('change.filterGuidelines');
    }
  };

})(jQuery, Drupal);
;
/**
 * @file
 * Like and dislike icons behavior.
 */
(function ($, Drupal) {

    Drupal.behaviors.likeAndDislike = {
      attach: function(context, settings) {
        $('.vote-like a').unbind('click');
        $('.vote-like a').click(function() {
          var entity_id, entity_type;
          if (!$(this).hasClass('disable-status')) {
            entity_id = $(this).data('entity-id');
            entity_type = $(this).data('entity-type');
            likeAndDislikeService.vote(entity_id, entity_type, 'like');
          }
        });
        $('.vote-dislike a').unbind('click');
        $('.vote-dislike a').click(function() {
          var entity_id, entity_type;
          if (!$(this).hasClass('disable-status')) {
            entity_id = $(this).data('entity-id');
            entity_type = $(this).data('entity-type');
            likeAndDislikeService.vote(entity_id, entity_type, 'dislike');
          }
        });
      }
    };

})(jQuery, Drupal);
;
/**
 * @file
 * Like and dislike icons behavior.
 */
(function ($, Drupal) {

  window.likeAndDislikeService = (function() {
    function likeAndDislikeService() {}
    likeAndDislikeService.vote = function(entity_id, entity_type, tag) {
      $.ajax({
        type: "GET",
        url: drupalSettings.path.baseUrl + 'like_and_dislike/' + entity_type + '/' + tag + '/' + entity_id,
        success: function(response) {
          // Expected response is a json object where likes is the new number
          // of likes, dislikes is the new number of dislikes, message_type is
          // the type of message to display ("status" or "warning") and message
          // is the message to display.
          // @todo: Add/remove classes via jQuery.
          $('#like-container-' + entity_type + '-' + entity_id + ' a').get(0).className = response.operation.like;
          $('#dislike-container-' + entity_type + '-' + entity_id + ' a').get(0).className = response.operation.dislike;

          // Updates the likes and dislikes count.
          $('#like-container-' + entity_type + '-' + entity_id + ' .count').html(response.likes);
          $('#dislike-container-' + entity_type + '-' + entity_id + ' .count').html(response.dislikes);
          // Display a message whether the vote was registered or an error
          // happened
          $('.region.region-highlighted').html("<div class='messages__wrapper layout-container'><div class='messages messages--" + response.message_type + " role='contentinfo'>" + response.message + "</div></div>");
        }
      });
    };
    return likeAndDislikeService;
  })();

})(jQuery, Drupal);
;
