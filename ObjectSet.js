module.exports = class ObjectSet extends Set {
    add(element) {
        let compare = this.getComparator()
        for (let object of this) {
            if (compare(element, object) == 0) return
        }
        Set.prototype.add.call(this, element);
    }

    addAll(iterable) {
        for (let object of iterable) this.add(object)
    }

    remove(element) {
        let compare = this.getComparator()
        for (let object of this) {
            if (compare(element, object) == 0) {
                Set.prototype.delete.call(this, object);
            }
        }
    }

    removeAll(iterable) {
        for (let object of iterable) this.remove(object)
    }

    constructor(comparator) {
        super();
        comparator = comparator || function(o1, o2) {
            return o1 == o2 ? 0 : -1
        }
        this.getComparator = function() {
            return comparator
        }
    }
}