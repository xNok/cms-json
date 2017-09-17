export const TYPE_TREE = "tree";
export const TYPE_MAP_OBJECT = "map<object>";
export const TYPE_MAP_STRING = "map<string>";
export const TYPE_LIST_OBJECT = "list<object>";
export const FIELD_TYPE_STRING = "string";
export const FIELD_TYPE_BOOLEAN = "boolean";
export const FIELD_TYPE_ARRAY = "array";
export const FIELD_TYPE_MARKDOWN = "markdown";

enum NodeType {
	TYPE_TREE = 'tree',
	TYPE_MAP_OBJECT = 'map<object>',
	TYPE_MAP_STRING = "map<string>",
	TYPE_LIST_OBJECT = "list<object>"
}

interface Model {
	name: string;
	children?: Model[];
	type: string;
	list?: boolean;
	fields?: any[];
}

interface Field {
	name: string,
	type: string,
	key: boolean
}

interface Node {
	model: Model;
	data: any;
	parent: Node;
	path: string,
	treePath: string,
	fieldIndex: number
}

interface Path {
	fullPath: string,
	treePath: any,
	dataIndex: any
}

export const getNodeType = (node: Node) : string => {
	if (node.model.type) {
		return node.model.type;
	} else {
		if (node.model.list) { // legacy
			return TYPE_LIST_OBJECT;
		} else {
			return TYPE_TREE;
		}
	}
};

export const getFieldAt = (node: Node, fieldIndex: number) : Field => {
	if (fieldIndex < 0) {
		throw new Error(`Negative field index`);
	}
	if (node.model.fields && fieldIndex < node.model.fields.length) {
		return getField(node.model.fields[fieldIndex]);
	}
	throw new Error(`No field at index ${fieldIndex} for node ${node.model.name}`);
};

export const getFieldNamed = (node: Node, name : string) : Field => {
	return getFields(node).filter(f => f.name === name)[0];
};

export const getFieldIndex = (node : Node, field : Field) => {
	field = getField(field);
	const fields = getFields(node);
	for (let i = 0; i < fields.length; i++) {
		const f = fields[i];
		if (field.name === f.name) {
			return i;
		}
	}
	throw new Error(`Cannot find fieldIndex for field ${field.name} in node ${node.model.name}`);
};

export const getField = (f : any) : Field => {
	return typeof f === 'string' ? { name: f } : f;
};

export const getFields = (node : Node) : Field[] => {
	const fields = node.model.fields;
	if (fields) {
		return fields.map(f => typeof f === 'string' ? { name: f } : f);
	}
	return [];
};

export const isMapType = (node : Node) : boolean => {
	const nodeType = getNodeType(node);
	return [ TYPE_MAP_STRING, TYPE_MAP_OBJECT ].includes(nodeType);
};

export const isKeyField = (field : Field) : boolean => {
	return typeof field === 'object' && field.key;
};

export const findNode = (node : Node, path : any) => {
	if (path === '') {
		return node;
	}
	if (typeof path === 'string') {
		path = path.split('/');
	}
	return _findNode(node, path);
};

export const getChildren = (node: Node) : Node[] => {
	const children:Node[] = [];
	if (node.model.children && node.model.children.length > 0) {
		node.model.children.forEach(modelChild => {
			let childPath = (node.path ? (node.path + '/') : '') + slugify(modelChild.name);
			children.push({
				model: modelChild,
				data: node.data[slugify(modelChild.name)],
				parent: node,
				path: childPath,
				treePath: childPath,
				fieldIndex: -1
			});
		});
	}
	return children;
};

export const deleteNode = (node : Node) : void => {
	const parentNode = node.parent;
	const modelChildren = parentNode.model.children!;
	for (let i = 0; i < modelChildren.length; i++) {
		const modelChild = modelChildren[i];
		if (modelChild.name === node.model.name) {
			modelChildren.splice(i, 1);
			delete parentNode.data[slugify(node.model.name)];
			return;
		}
	}
	throw new Error(`Could not delete node '${node.model.name}'`);
};

/**
 * Removes the last path fragment if it is a number
 * 		/foo/bar/5 => /foo/bar
 *
 * @param tree
 * @param path
 * @returns {*}
 */
export const treePathAndIndex = (tree: Node, path: string) : Path => {
	let res = _treePathAndIndex(tree, Array.isArray(path) ? path : (path.length > 0 ? path.split('/') : ''), {
		fullPath: path,
		treePath: [],
		dataIndex: -1
	});
	res.treePath = res.treePath.join('/');
	return res;
};

const _treePathAndIndex = function(node: Node, path: any, result) : Path {
	if (path.length > 0) {
		const p = path[0];
		if (node.model.children && node.model.children.length > 0) {
			result.treePath = [ ...result.treePath, p ];
			_treePathAndIndex(_findChild(node, p), path.slice(1), result);
		} else {
			switch (getNodeType(node)) {
				case TYPE_LIST_OBJECT:
					result.dataIndex = parseInt(p);
					break;
				case TYPE_MAP_OBJECT:
				case TYPE_MAP_STRING:
					result.dataIndex = p;
					break;
				default:
					throw new Error('No child for path ${path}');
			}
		}
	}
	return result;
};

const _findChild = (node: Node, slug: string) : Node => {
	if (node.model.children) {
		for (let i = 0; i < node.model.children.length; i++) {
			if (slugify(node.model.children[i].name) === slug) {
				let childPath = node.path + '/' + slug;
				return {
					model: node.model.children[i],
					data: node.data[slug],
					parent: node,
					path: childPath,
					treePath: childPath,
					fieldIndex: -1
				};
			}
		}
	}
	throw new Error(`Could not find child with slug ${slug} in node ${node.model.name}`);
};

export const getDataItems = (node: Node): any[] => {
	switch (getNodeType(node)) {
		case TYPE_LIST_OBJECT:
			return node.data;
		case TYPE_MAP_OBJECT:
		case TYPE_MAP_STRING:
			return Object.values(node.data);
		default:
			throw new Error("Cannot list items for type: " + node.model.type);
	}
};

const _findNewListItemName = (node: Node, newName: string, idx: number): string => {
	const fullName = (idx === 1) ? newName : (newName + " (" + idx + ")");
	const fieldName = defaultFieldName(node.model);
	const items = getDataItems(node);
	for (let i = 0; i < items.length; i++) {
		let item = items[i];
		let name = item[fieldName];
		if (name === fullName) {
			return _findNewListItemName(node, newName, idx + 1);
		}
	}
	return fullName;
};

const _findNewMapKey = (node: Node, newName: string, idx: number) => {
	const fullName = (idx === 1) ? newName : (newName + " (" + idx + ")");
	if (typeof node.data[fullName] !== 'undefined') {
		return _findNewMapKey(node, newName, idx + 1);
	}
	return fullName;
};

const _findNewNodeName = (node: Node, newName: string, idx: number): string => {
	const fullName = (idx === 1) ? newName : (newName + " (" + idx + ")");
	const children = node.model.children;
	if (children) {
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			let name = child["name"];
			if (name === fullName) {
				return _findNewNodeName(node, newName, idx + 1);
			}
		}
	}
	return fullName;
};

export const addItem = (node: Node, requestedName: string) => {
	const nodeType = getNodeType(node);
	let item;
	let dataIndex;
	switch (nodeType) {
		case TYPE_MAP_OBJECT:
			item = {};
			dataIndex = _findNewMapKey(node, requestedName, 1);
			node.data[dataIndex] = item;
			break;
		case TYPE_MAP_STRING:
			item = "New value";
			dataIndex = _findNewMapKey(node, requestedName, 1);
			node.data[dataIndex] = item;
			break;
		case TYPE_LIST_OBJECT:
			item = {
				[defaultFieldName(node.model)] : _findNewListItemName(node, requestedName, 1)
			};
			node.data.push(item);
			dataIndex = node.data.length - 1;
			break;
		default:
			throw new Error(`Cannot add item to node of type ${nodeType}`);
	}
	return { dataIndex, item };
};

export const addNode = (node: Node, requestedName: string, nodeType: string): Node => {
	const newModel: Model = {
		name : _findNewNodeName(node, requestedName, 1),
		type: nodeType,
	};
	let newData;
	switch (nodeType) {
		case TYPE_TREE:
			newModel.children = [];
			newData = {};
			break;
		case TYPE_MAP_OBJECT:
			newModel.fields = [ { name: "Key", key: true } ];
			newData = {};
			break;
		case TYPE_MAP_STRING:
			newModel.fields = [ { name: "Key", key: true }, "Value" ];
			newData = {};
			break;
		case TYPE_LIST_OBJECT:
			newModel.fields = [ "Name" ];
			newData = [];
			break;
	}
	if (!node.model.children) {
		node.model.children = [];
	}
	node.model.children.push(newModel);
	node.data[slugify(newModel.name)] = newData;
	let path = node.path + '/' + slugify(newModel.name);
	return Object.assign(
		{},
		node,
		{
			model: newModel,
			data: newData,
			path: path,
			treePath: path,
			parent: node,
			dataIndex: -1
		}
	);
};

/**
 * Get the node holding the 'struct' data: either this node, or its parent, if the data held
 * is an 'item' (from a map or an array)
 */
const _getStructNode = (node) => {
	if (node.dataIndex !== -1) {
		return node.parent;
	}
	return node;
};

export const renameNode = function (node, name) {
	const previousName = node.model.name;
	node.model.name = name;
	if (node.parent) {
		node.parent.data[slugify(name)] = node.parent.data[slugify(previousName)];
		node.path = node.parent.path ? (node.parent.path + '/' + slugify(name)) : slugify(name);
		node.treePath = node.path;
		delete node.parent.data[slugify(previousName)];
	}
};

const _checkDeleteFieldAt = (node, fieldIndex) => {
	const field = getFieldAt(node, fieldIndex);
	if (field.key) {
		throw new Error(`Cannot delete: field ${field.name} is a key field for node '${node.name}'`);
	}
	const nodeType = getNodeType(node);
	if (nodeType === TYPE_MAP_STRING) {
		throw new Error(`Cannot delete: field ${field.name} is the value field for node '${node.name}', which is a map(string)`);
	}
	return field;
};

export const canDeleteFieldAt = (node, fieldIndex) => {
	try {
		_checkDeleteFieldAt(node, fieldIndex);
	} catch (err) {
		return false;
	}
	return true;
};

export const deleteFieldAt = (node, fieldIndex) => {
	const field = _checkDeleteFieldAt(node, fieldIndex);
	const structNode = _getStructNode(node);
	getDataItems(structNode).forEach(item => delete item[slugify(field.name)]);
	node.model.fields.splice(fieldIndex, 1);
};

export const updateFieldAt = (node, fieldIndex, field) => {
	if (typeof fieldIndex === 'undefined' || fieldIndex === -1) {
		// The field does not exist, just compute the new model index
		fieldIndex = node.model.fields.length;
	} else {
		// Field exists already, we need to perform a data refactoring
		const newField = getField(field);
		const prevField = getField(node.model.fields[fieldIndex]);
		const structNode = _getStructNode(node);
		const nodeType = getNodeType(structNode);
		if (newField.name !== prevField.name
			&& [TYPE_LIST_OBJECT, TYPE_MAP_OBJECT].includes(nodeType)
			&& !newField.key) {
				getDataItems(structNode).forEach(item => {
					item[slugify(newField.name)] = item[slugify(prevField.name)];
					delete item[slugify(prevField.name)];
				});
		}
		if (newField.type !== prevField.type) {
			getDataItems(structNode).forEach(item => {
				item[slugify(newField.name)] = _convert(item[slugify(newField.name)], prevField.type, newField.type);
			});
		}
	}
	// Update the model
	node.model.fields[fieldIndex] = field;
};

const _convert = (value, prevFieldType, newFieldType) => {
	switch (newFieldType) {
		case FIELD_TYPE_STRING:
		case FIELD_TYPE_MARKDOWN:
			return value ? "" + value : "";
		case FIELD_TYPE_BOOLEAN:
			return !!value;
		case FIELD_TYPE_ARRAY:
			return [ value ];
		default:
			throw new Error(`Unknown type: ${newFieldType}`);
	}
};

export const findDeepest = (node, path) => _findDeepest(node, ensureArray(path), 0);

const _findDeepest = (node, path, depth) => {
	const found = node[path[0]];
	if (found) {
		return _findDeepest(found, path.slice(1), depth + 1);
	} else {
		return { node: node, depth: depth };
	}
};

const _findNode = (node, path) => {
	const nodeType = getNodeType(node);
	if (path.length === 0) {
		return node;
	}
	const next = path[0];
	if (nodeType === TYPE_TREE) {
		for (let c = 0; c < node.model.children.length; c++) {
			const childModel = node.model.children[c];
			if (slugify(childModel.name) === next) {
				let treePath = (node.path ? (node.path + '/') : '') + next;
				return _findNode({
					model: childModel,
					data: node.data[next] || (getNodeType(childModel) === TYPE_LIST_OBJECT ? [] : {}),
					parent: node,
					path: treePath,
					treePath: treePath,
					dataIndex: -1
				}, path.slice(1));
			}
		}
		throw new Error(`Could not find child named ${next} in node ${node.model.name}`);
	} else if (nodeType === TYPE_LIST_OBJECT) {
		const dataIndex = parseInt(next);
		return {
			model: node.model,
			data: node.data[dataIndex] || {},
			parent: node,
			path: (node.path ? (node.path + '/') : '') + next,
			treePath: node.path,
			dataIndex: dataIndex
		};
	} else {
		// Map
		return {
			model: node.model,
			data: node.data[next] || (nodeType === TYPE_MAP_OBJECT ? {} : ""),
			parent: node,
			path: (node.path ? (node.path + '/') : '') + next,
			treePath: node.path,
			dataIndex: next
		};
	}
};

export const defaultFieldName = (model) => {
		const field = model.fields[0];
		if (typeof field === 'object') {
			return slugify(field.name);
		} else {
			return slugify(field);
		}
};

// const _findKey = (model) => {
// 	if (model.fields && model.fields.length > 0) {
// 		let keys = model.fields.filter(f => f.key);
// 		if (keys.length === 1) {
// 			return keys[0];
// 		}
// 	}
// 	throw new Error(`Could not find a field marked as key for model ${model.name}`);
// };

export const fieldName = (field) => (typeof field === 'string') ? slugify(field) : slugify(field.name);

export const fieldDisplayName = (field) => (typeof field === 'string') ? field : field.name;

export const slugify = (str) => str.replace(/\s/g, '_').replace(/\//g, '-').toLowerCase();

export const isItem = (node) => [TYPE_LIST_OBJECT, TYPE_MAP_OBJECT, TYPE_MAP_STRING].includes(getNodeType(node));

const ensureArray = path => typeof path === 'string' ? path.split('/') : path;