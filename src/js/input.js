/**
 * Form control (input, select, textarea) helper functions.
 */

import types from './types';
import events from './event';
import { closestAncestorUntil } from './dom-utils';
import $ from 'jquery';

export default {
    getWrapNode( control ) {
        return control.closest( '.question, .calculation' );
    },
    getWrapNodes( controls ) {
        const result = [];
        controls.forEach( control => {
            const question = this.getWrapNode( control );
            if ( !result.includes( question ) ) {
                result.push( question );
            }
        } );
        return result;
    },
    /** very inefficient, should actually not be used **/
    getProps( control ) {
        return {
            path: this.getName( control ),
            ind: this.getIndex( control ),
            inputType: this.getInputType( control ),
            xmlType: this.getXmlType( control ),
            constraint: this.getConstraint( control ),
            calculation: this.getCalculation( control ),
            relevant: this.getRelevant( control ),
            readonly: this.getReadonly( control ),
            val: this.getVal( $( control ) ),
            required: this.getRequired( control ),
            enabled: this.isEnabled( control ),
            multiple: this.isMultiple( control )
        };
    },
    getInputType( control ) {
        const nodeName = control.nodeName.toLowerCase();
        if ( nodeName === 'input' ) {
            if ( control.dataset.drawing ) {
                return 'drawing';
            }
            if ( control.type ) {
                return control.type.toLowerCase();
            }
            return console.error( '<input> node has no type' );

        } else if ( nodeName === 'select' ) {
            return 'select';
        } else if ( nodeName === 'textarea' ) {
            return 'textarea';
        } else if ( nodeName === 'fieldset' || nodeName === 'section' ) {
            return 'fieldset';
        } else {
            return console.error( 'unexpected input node type provided' );
        }
    },
    getConstraint( control ) {
        return control.dataset.constraint;
    },
    getRequired( control ) {
        // only return value if input is not a table heading input
        if ( !closestAncestorUntil( control, '.or-appearance-label', '.or' ) ) {
            return control.dataset.required;
        }
    },
    getRelevant( control ) {
        return control.dataset.relevant;
    },
    getReadonly( control ) {
        return control.matches( '[readonly]' );
    },
    getCalculation( control ) {
        return control.dataset.calculate;
    },
    getXmlType( control ) {
        return control.dataset.typeXml;
    },
    getName( control ) {
        const name = control.dataset.name || control.getAttribute( 'name' );
        if ( !name ) {
            console.error( 'input node has no name' );
        }
        return name;
    },
    /**
     * Used to retrieve the index of a question amidst all questions with the same name.
     * The index that can be used to find the corresponding node in the model.
     * NOTE: this function should be used sparingly, as it is CPU intensive!
     */
    getIndex( control ) {
        return this.form.repeats.getIndex( control.closest( '.or-repeat' ) );
    },
    isMultiple( control ) {
        return this.getInputType( control ) === 'checkbox' || control.multiple;
    },
    isEnabled( control ) {
        return !( control.disabled || closestAncestorUntil( control, '.disabled', '.or' ) );
    },
    getVal( $input ) {
        const input = $input[ 0 ];
        let inputType;
        const values = [];
        let name;

        if ( $input.length !== 1 ) {
            return console.error( 'getVal(): no inputNode provided or multiple' );
        }
        inputType = this.getInputType( input );
        name = this.getName( input );

        if ( inputType === 'radio' ) {
            const checked = this.getWrapNode( input ).querySelector( `input[type="radio"][data-name="${name}"]:checked` );
            return checked ? checked.value : '';
        }

        if ( inputType === 'checkbox' ) {
            this.getWrapNode( input ).querySelectorAll( `input[type="checkbox"][name="${name}"]:checked` ).forEach( input => values.push( input.value ) );
            return values;
        }
        return $input.val() || '';
    },
    find( name, index ) {
        let attr = 'name';
        if ( this.form.view.html.querySelector( `input[type="radio"][data-name="${name}"]:not(.ignore)` ) ) {
            attr = 'data-name';
        }
        const question = this.getWrapNodes( this.form.view.html.querySelectorAll( `[${attr}="${name}"]` ) )[ index ];

        return question ? question.querySelector( `[${attr}="${name}"]:not(.ignore)` ) : null;
    },
    setVal( $input, value, event = events.InputUpdate() ) {
        let inputs;
        const input = $input[ 0 ];
        const type = this.getInputType( input );
        const question = this.getWrapNode( input );
        const name = this.getName( input );

        if ( type === 'radio' ) {
            // data-name is always present on radiobuttons
            inputs = question.querySelectorAll( `[data-name="${name}"]:not(.ignore)` );
        } else {
            // why not use this.getIndex?
            inputs = question.querySelectorAll( `[name="${name}"]:not(.ignore)` );

            if ( type === 'file' ) {
                // value of file input can be reset to empty but not to a non-empty value
                if ( value ) {
                    input.setAttribute( 'data-loaded-file-name', value );
                    // console.error('Cannot set value of file input field (value: '+value+'). If trying to load '+
                    //  'this record for editing this file input field will remain unchanged.');
                    return false;
                }
            }

            if ( type === 'date' || type === 'datetime' ) {
                // convert current value (loaded from instance) to a value that a native datepicker understands
                // TODO: test for IE, FF, Safari when those browsers start including native datepickers
                value = types[ type ].convert( value );
            }

            if ( type === 'time' ) {
                // convert to a local time value that HTML time inputs and the JS widget understand (01:02)
                if ( /(\+|-)/.test( value ) ) {
                    // Use today's date to incorporate daylight savings changes,
                    // Strip the thousands of a second, because most browsers fail to parse such a time.
                    // Add a space before the timezone offset to satisfy some browsers.
                    // For IE11, we also need to strip the Left-to-Right marks \u200E...
                    const ds = `${new Date().toLocaleDateString( 'en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
} ).replace( /\u200E/g, '' )} ${value.replace( /(\d\d:\d\d:\d\d)(\.\d{1,3})(\s?((\+|-)\d\d))(:)?(\d\d)?/, '$1 GMT$3$7' )}`;
                    const d = new Date( ds );
                    if ( d.toString() !== 'Invalid Date' ) {
                        value = `${d.getHours().toString().pad( 2 )}:${d.getMinutes().toString().pad( 2 )}`;
                    } else {
                        console.error( 'could not parse time:', value );
                    }
                }
            }
        }

        if ( this.isMultiple( input ) === true ) {
            // TODO: It's weird that setVal does not take an array value but getVal returns an array value for multiple selects!
            value = value.split( ' ' );
        } else if ( type === 'radio' ) {
            value = [ value ];
        }

        // Trigger an 'inputupdate' event which can be used in widgets to update the widget when the value of its 
        // original input element has changed **programmatically**.
        if ( inputs.length ) {
            const curVal = this.getVal( $input );
            if ( curVal === undefined || curVal.toString() !== value.toString() ) {
                $( inputs ).val( value );
                // don't trigger on all radiobuttons/checkboxes
                if ( event ) {
                    inputs[ 0 ].dispatchEvent( event );
                }
            }
        }

        return inputs[ 0 ];
    },
    validate( $input ) {
        return this.form.validateInput( $input );
    }
};
