import faker from 'faker';
import {isObject, map, range, uniq} from 'lodash'
import {attempt} from 'lodash/util';

/**
 * List of all names
 */
const ALL_NAMES = generateData();
function generateData(count = 10000) {
    return map(range(count), () => {
        return faker.name.findName();
    });
}

/**
 * Use this function to filter the results you want to return to the client.
 * Any edits to this file should only be made in the body of this function
 * unless you have some really good reason to make other changes
 * @param  {String[]} input     user input
 * @return {String[]}           Filtered names
 */
function filterNames(...input) { //simulate a table to match param

}

/**
 * Mock server to return list of names
 * @param  {String}   input user input
 * @param  {Function} cb    callback
 */
export function getNames(input, cb) {



    setTimeout(() => {
        cb(filterNames(input));
    }, 300);
};
