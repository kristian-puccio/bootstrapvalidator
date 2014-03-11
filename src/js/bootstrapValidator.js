/**
 * BootstrapValidator (https://github.com/nghuuphuoc/bootstrapvalidator)
 *
 * A jQuery plugin to validate form fields. Use with Bootstrap 3
 *
 * @author      http://twitter.com/nghuuphuoc
 * @copyright   (c) 2013 - 2014 Nguyen Huu Phuoc
 * @license     MIT
 */

(function($) {
    var BootstrapValidator = function(form, options) {
        this.$form   = $(form);
        this.options = $.extend({}, BootstrapValidator.DEFAULT_OPTIONS, options);

        this.dfds    = {};      // Array of deferred
        this.results = {};      // Validating results

        this.invalidField  = null;  // First invalid field
        this.$submitButton = null;  // The submit button which is clicked to submit form

        this._init();

        this.STATUS_NOT_VALIDATED = 'NOT_VALIDATED';
        this.STATUS_VALIDATING    = 'VALIDATING';
        this.STATUS_INVALID       = 'INVALID';
        this.STATUS_VALID         = 'VALID';
    };

    // The default options
    BootstrapValidator.DEFAULT_OPTIONS = {
        // The form CSS class
        elementClass: 'bootstrap-validator-form',

        // Default invalid message
        message: 'This value is not valid',

        // The number of grid columns
        // Change it if you use custom grid with different number of columns
        columns: 12,

        // Shows ok/error/loading icons based on the field validity.
        // This feature requires Bootstrap v3.1.0 or later (http://getbootstrap.com/css/#forms-control-validation).
        // Since Bootstrap doesn't provide any methods to know its version, this option cannot be on/off automatically.
        // In other word, to use this feature you have to upgrade your Bootstrap to v3.1.0 or later.
        //
        // Examples:
        // - Use Glyphicons icons:
        //  feedbackIcons: {
        //      valid: 'glyphicon glyphicon-ok',
        //      invalid: 'glyphicon glyphicon-remove',
        //      validating: 'glyphicon glyphicon-refresh'
        //  }
        // - Use FontAwesome icons:
        //  feedbackIcons: {
        //      valid: 'fa fa-check',
        //      invalid: 'fa fa-times',
        //      validating: 'fa fa-refresh'
        //  }
        feedbackIcons: null,

        // The submit buttons selector
        // These buttons will be disabled to prevent the valid form from multiple submissions
        submitButtons: 'button[type="submit"]',

        // The custom submit handler
        // It will prevent the form from the default submission
        //
        //  submitHandler: function(validator, form) {
        //      - validator is the BootstrapValidator instance
        //      - form is the jQuery object present the current form
        //  }
        submitHandler: null,

        // Live validating option
        // Can be one of 3 values:
        // - enabled: The plugin validates fields as soon as they are changed
        // - disabled: Disable the live validating. The error messages are only shown after the form is submitted
        // - submitted: The live validating is enabled after the form is submitted
        live: 'enabled',

        // Map the field name with validator rules
        fields: null
    };

    BootstrapValidator.prototype = {
        constructor: BootstrapValidator,

        /**
         * Init form
         */
        _init: function() {
            if (this.options.fields == null) {
                return;
            }

            var that = this;
            this.$form
                // Disable client side validation in HTML 5
                .attr('novalidate', 'novalidate')
                .addClass(this.options.elementClass)
                // Disable the default submission first
                .on('submit.bootstrapValidator', function(e) {
                    e.preventDefault();
                    that.validate();
                })
                .find(this.options.submitButtons)
                    .on('click', function() {
                        that.$submitButton = $(this);
                    });

            for (var field in this.options.fields) {
                this._initField(field);
            }

            this._setLiveValidating();
        },

        /**
         * Init field
         *
         * @param {String} field The field name
         */
        _initField: function(field) {
            if (this.options.fields[field] == null || this.options.fields[field].validators == null) {
                return;
            }

            this.dfds[field]    = {};
            this.results[field] = {};

            var fields = this.getFieldElements(field);

            // We don't need to validate non-existing fields
            if (fields == null) {
                delete this.options.fields[field];
                delete this.dfds[field];
                return;
            }

            // Create a help block element for showing the error
            var $field  = $(fields[0]),
                $parent = $field.parents('.form-group'),
                // Calculate the number of columns of the label/field element
                // Then set offset to the help block element
                label, cssClasses, offset, size;

            if (label = $parent.find('label').get(0)) {
                // The default Bootstrap form don't require class for label (http://getbootstrap.com/css/#forms)
                if (cssClasses = $(label).attr('class')) {
                    cssClasses = cssClasses.split(' ');
                    for (var i = 0; i < cssClasses.length; i++) {
                        if (/^col-(xs|sm|md|lg)-\d+$/.test(cssClasses[i])) {
                            offset = cssClasses[i].substr(7);
                            size   = cssClasses[i].substr(4, 2);
                            break;
                        }
                    }
                }
            } else if (cssClasses = $parent.children().eq(0).attr('class')) {
                cssClasses = cssClasses.split(' ');
                for (var i = 0; i < cssClasses.length; i++) {
                    if (/^col-(xs|sm|md|lg)-offset-\d+$/.test(cssClasses[i])) {
                        offset = cssClasses[i].substr(14);
                        size   = cssClasses[i].substr(4, 2);
                        break;
                    }
                }
            }

            if (size && offset) {
                for (var validatorName in this.options.fields[field].validators) {
                    if (!$.fn.bootstrapValidator.validators[validatorName]) {
                        delete this.options.fields[field].validators[validatorName];
                        continue;
                    }

                    this.results[field][validatorName] = this.STATUS_NOT_VALIDATED;
                    $('<small/>')
                        .css('display', 'none')
                        .attr('data-bs-validator', validatorName)
                        .addClass('help-block')
                        .addClass(['col-', size, '-offset-', offset].join(''))
                        .addClass(['col-', size, '-', this.options.columns - offset].join(''))
                        .appendTo($parent);
                }
            }

            // Prepare the feedback icons
            // Available from Bootstrap 3.1 (http://getbootstrap.com/css/#forms-control-validation)
            if (this.options.feedbackIcons) {
                $parent.addClass('has-feedback');
                $('<i/>').css('display', 'none').addClass('form-control-feedback').insertAfter($(fields[fields.length - 1]));
            }

            if (this.options.fields[field]['enabled'] == null) {
                this.options.fields[field]['enabled'] = true;
            }

            // Whenever the user change the field value, mark it as not validated yet
            var that  = this,
                type  = fields.attr('type'),
                event = ('radio' == type || 'checkbox' == type || 'SELECT' == fields[0].tagName) ? 'change' : 'keyup';
            fields.on(event, function() {
                for (var v in that.options.fields[field].validators) {
                    that.results[field][v] = that.STATUS_NOT_VALIDATED;
                }
            });
        },

        /**
         * Enable live validating
         */
        _setLiveValidating: function() {
            if ('enabled' == this.options.live) {
                var that = this;
                for (var field in this.options.fields) {
                    (function(f) {
                        var fields = that.getFieldElements(f);
                        if (fields) {
                            var type  = fields.attr('type'),
                                event = ('radio' == type || 'checkbox' == type || 'SELECT' == fields[0].tagName) ? 'change' : 'keyup';

                            fields.on(event, function() {
                                that.validateField(f);
                            });
                        }
                    })(field);
                }
            }
        },

        /**
         * Disable/Enable submit buttons
         *
         * @param {Boolean} disabled
         */
        _disableSubmitButtons: function(disabled) {
            if (!disabled) {
                this.$form.find(this.options.submitButtons).removeAttr('disabled');
            } else if (this.options.live != 'disabled') {
                // Don't disable if the live validating mode is disabled
                this.$form.find(this.options.submitButtons).attr('disabled', 'disabled');
            }
        },

        /**
         * Called when all validations are completed
         */
        _submit: function() {
            if (!this.isValid()) {
                if ('submitted' == this.options.live) {
                    this.options.live = 'enabled';
                    this._setLiveValidating();
                }

                // Focus to the first invalid field
                if (this.invalidField) {
                    this.getFieldElements(this.invalidField).focus();
                }
                return;
            }

            this._disableSubmitButtons(true);

            // Call the custom submission if enabled
            if (this.options.submitHandler && 'function' == typeof this.options.submitHandler) {
                this.options.submitHandler.call(this, this, this.$form, this.$submitButton);
            } else {
                // Submit form
                this.$form.off('submit.bootstrapValidator').submit();
            }
        },

        // --- Public methods ---

        /**
         * Retrieve the field elements by given name
         *
         * @param {String} field The field name
         * @returns {null|jQuery[]}
         */
        getFieldElements: function(field) {
            var fields = this.$form.find('[name="' + field + '"]');
            return (fields.length == 0) ? null : fields;
        },

        /**
         * Validate the form
         *
         * @return {BootstrapValidator}
         */
        validate: function() {
            if (!this.options.fields) {
                return this;
            }
            this._disableSubmitButtons(true);

            for (var field in this.options.fields) {
                this.validateField(field);
            }

            this._submit();
            return this;
        },

        /**
         * Validate given field
         *
         * @param {String} field The field name
         */
        validateField: function(field) {
            if (!this.options.fields[field]['enabled']) {
                return;
            }

            var that       = this,
                fields     = this.getFieldElements(field),
                $field     = $(fields[0]),
                validators = this.options.fields[field].validators,
                validatorName,
                validateResult;

            // We don't need to validate disabled field
            if (fields.length == 1 && fields.is(':disabled')) {
                delete this.options.fields[field];
                delete this.dfds[field];
                return;
            }

            for (validatorName in validators) {
                if (this.dfds[field][validatorName]) {
                    this.dfds[field][validatorName].reject();
                }

                // Don't validate field if it is already done
                if (this.results[field][validatorName] == this.STATUS_VALID || this.results[field][validatorName] == this.STATUS_INVALID) {
                    continue;
                }

                this.results[field][validatorName] = this.STATUS_VALIDATING;
                validateResult = $.fn.bootstrapValidator.validators[validatorName].validate(this, $field, validators[validatorName]);

                if ('object' == typeof validateResult) {
                    this.updateStatus($field, validatorName, this.STATUS_VALIDATING);
                    this.dfds[field][validatorName] = validateResult;

                    validateResult.done(function(isValid, v) {
                        // v is validator name
                        delete that.dfds[field][v];
                        isValid ? that.updateStatus($field, v, that.STATUS_VALID)
                                : that.updateStatus($field, v, that.STATUS_INVALID);
                    });
                } else if ('boolean' == typeof validateResult) {
                    validateResult ? this.updateStatus($field, validatorName, this.STATUS_VALID)
                                   : this.updateStatus($field, validatorName, this.STATUS_INVALID);
                }
            }
        },

        /**
         * Updates the error display for a field.
         *
         * @param {jQuery} $field The field element
         */
        updateDisplay: function($field) {
            console.log('UPDATE DISPLAY');

            var that       = this,
                field     = $field.attr('name'),
                validators = this.options.fields[field].validators,
                $parent   = $field.parents('.form-group'),
                $errors   = $parent.find('.help-block[data-bs-validator]');

            // Start off as valid
            var validateResult = this.STATUS_VALID;

            for (validatorName in validators) {
                var status = this.results[field][validatorName];

                switch (status) {
                    case this.STATUS_INVALID:
                        validateResult = this.STATUS_INVALID;
                        this._disableSubmitButtons(true);

                        // Add has-error class to parent element
                        $parent.removeClass('has-success').addClass('has-error');

                        $errors.filter('[data-bs-validator="' + validatorName + '"]').html(message).show();

                        if (this.options.feedbackIcons) {
                            // Show invalid icon
                            $parent.find('.form-control-feedback').removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.validating).addClass(this.options.feedbackIcons.invalid).show();
                        }
                        break;

                    case this.STATUS_VALIDATING:
                        validateResult = this.STATUS_VALIDATING;
                        break;

                    case this.STATUS_VALID:
                        validateResult = this.STATUS_VALID;
                        break;

                    default:
                        break;

                }

                console.log(validateResult, "<<<< result");

                if (validateResult === this.STATUS_INVALID) {
                    break;
                }
            }


            if (validateResult === this.STATUS_VALID) {
                // Hide error element
                $errors.filter('[data-bs-validator="' + validatorName + '"]').hide();

                // If the field is valid
                if ($errors.filter(function() {
                        var display = $(this).css('display'), v = $(this).attr('data-bs-validator');
                        return ('block' == display) || (that.results[field][v] != that.STATUS_VALID);
                    }).length == 0
                ) {
                    this._disableSubmitButtons(false);

                    $parent.removeClass('has-error').addClass('has-success');
                    // Show valid icon
                    if (this.options.feedbackIcons) {
                        $parent.find('.form-control-feedback').removeClass(this.options.feedbackIcons.invalid).removeClass(this.options.feedbackIcons.validating).addClass(this.options.feedbackIcons.valid).show();
                    }
                }
            } else if (validateResult === this.STATUS_VALIDATING) {
                this._disableSubmitButtons(true);

                $parent.removeClass('has-success').removeClass('has-error');
                // TODO: Show validating message
                $errors.filter('.help-block[data-bs-validator="' + validatorName + '"]').html(message).hide();

                if (this.options.feedbackIcons) {
                    // Show validating icon
                    $parent.find('.form-control-feedback').removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.invalid).addClass(this.options.feedbackIcons.validating).show();
                }
            }

        },

        /**
         * Check the form validity
         *
         * @returns {Boolean}
         */
        isValid: function() {
            var field, validatorName;
            for (field in this.results) {
                if (!this.options.fields[field]['enabled']) {
                    continue;
                }

                for (validatorName in this.results[field]) {
                    if (this.results[field][validatorName] == this.STATUS_NOT_VALIDATED || this.results[field][validatorName] == this.STATUS_VALIDATING) {
                        return false;
                    }

                    if (this.results[field][validatorName] == this.STATUS_INVALID) {
                        this.invalidField = field;
                        return false;
                    }
                }
            }

            return true;
        },

        /**
         * Update field status
         *
         * @param {jQuery} $field The field element
         * @param {String} validatorName
         * @param {String} status The status
         * Can be STATUS_VALIDATING, STATUS_INVALID, STATUS_VALID
         */
        updateStatus: function($field, validatorName, status) {
            var that      = this,
                field     = $field.attr('name'),
                validator = this.options.fields[field].validators[validatorName],
                message   = validator.message || this.options.message,
                $parent   = $field.parents('.form-group'),
                $errors   = $parent.find('.help-block[data-bs-validator]');

            switch (status) {
                case this.STATUS_VALIDATING:
                    this.results[field][validatorName] = this.STATUS_VALIDATING;
                    // this._disableSubmitButtons(true);

                    // $parent.removeClass('has-success').removeClass('has-error');
                    // // TODO: Show validating message
                    // $errors.filter('.help-block[data-bs-validator="' + validatorName + '"]').html(message).hide();

                    // if (this.options.feedbackIcons) {
                    //     // Show validating icon
                    //     $parent.find('.form-control-feedback').removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.invalid).addClass(this.options.feedbackIcons.validating).show();
                    // }
                    break;

                case this.STATUS_INVALID:
                    this.results[field][validatorName] = this.STATUS_INVALID;
                    this._disableSubmitButtons(true);

                    // // Add has-error class to parent element
                    // $parent.removeClass('has-success').addClass('has-error');

                    // $errors.filter('[data-bs-validator="' + validatorName + '"]').html(message).show();

                    // if (this.options.feedbackIcons) {
                    //     // Show invalid icon
                    //     $parent.find('.form-control-feedback').removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.validating).addClass(this.options.feedbackIcons.invalid).show();
                    // }
                    break;

                case this.STATUS_VALID:
                    this.results[field][validatorName] = this.STATUS_VALID;

                    // // Hide error element
                    // $errors.filter('[data-bs-validator="' + validatorName + '"]').hide();

                    // // If the field is valid
                    // if ($errors.filter(function() {
                    //         var display = $(this).css('display'), v = $(this).attr('data-bs-validator');
                    //         return ('block' == display) || (that.results[field][v] != that.STATUS_VALID);
                    //     }).length == 0
                    // ) {
                    //     this._disableSubmitButtons(false);

                    //     $parent.removeClass('has-error').addClass('has-success');
                    //     // Show valid icon
                    //     if (this.options.feedbackIcons) {
                    //         $parent.find('.form-control-feedback').removeClass(this.options.feedbackIcons.invalid).removeClass(this.options.feedbackIcons.validating).addClass(this.options.feedbackIcons.valid).show();
                    //     }
                    // }
                    break;

                default:
                    break;
            }

            this.updateDisplay($field);
        },

        // Useful APIs which aren't used internally

        /**
         * Reset the form
         *
         * @param {Boolean} resetFormData Reset current form data
         * @return {BootstrapValidator}
         */
        resetForm: function(resetFormData) {
            for (var field in this.options.fields) {
                this.dfds[field]    = {};
                this.results[field] = {};

                // Mark all fields as not validated yet
                for (var v in this.options.fields[field].validators) {
                    this.results[field][v] = this.STATUS_NOT_VALIDATED;
                }
            }

            this.invalidField  = null;
            this.$submitButton = null;

            // Hide all error elements
            this.$form
                .find('.has-error').removeClass('has-error').end()
                .find('.has-success').removeClass('has-success').end()
                .find('.help-block[data-bs-validator]').hide();

            // Enable submit buttons
            this._disableSubmitButtons(false);

            // Hide all feedback icons
            if (this.options.feedbackIcons) {
                this.$form.find('.form-control-feedback').removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.invalid).removeClass(this.options.feedbackIcons.validating).hide();
            }

            if (resetFormData) {
                this.$form.get(0).reset();
            }

            return this;
        },

        /**
         * Enable/Disable all validators to given field
         *
         * @param {String} field The field name
         * @param {Boolean} enabled Enable/Disable field validators
         * @return {BootstrapValidator}
         */
        enableFieldValidators: function(field, enabled) {
            this.options.fields[field]['enabled'] = enabled;
            if (enabled) {
                for (var v in this.options.fields[field].validators) {
                    this.results[field][v] = this.STATUS_NOT_VALIDATED;
                }
            } else {
                var $field  = this.getFieldElements(field),
                    $parent = $field.parents('.form-group');

                $parent.removeClass('has-success has-error').find('.help-block[data-bs-validator]').hide();
                if (this.options.feedbackIcons) {
                    $parent.find('.form-control-feedback').removeClass(this.options.feedbackIcons.invalid).removeClass(this.options.feedbackIcons.validating).removeClass(this.options.feedbackIcons.valid).hide();
                }

                this._disableSubmitButtons(false);
            }

            return this;
        }
    };

    // Plugin definition
    $.fn.bootstrapValidator = function(options) {
        return this.each(function() {
            var $this = $(this), data = $this.data('bootstrapValidator');
            if (!data) {
                $this.data('bootstrapValidator', (data = new BootstrapValidator(this, options)));
            }
            if ('string' == typeof options) {
                data[options]();
            }
        });
    };

    // Available validators
    $.fn.bootstrapValidator.validators = {};

    $.fn.bootstrapValidator.Constructor = BootstrapValidator;
}(window.jQuery));
